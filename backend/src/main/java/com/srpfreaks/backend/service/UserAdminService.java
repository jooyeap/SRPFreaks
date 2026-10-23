package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.AdminUserResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 사용자 관리 (ROOT 전용): 목록 조회, 역할 변경, 차단/차단 해제.
 *
 * 역할 변경 규칙 (권한 상승을 막는다)
 *  - 바꿀 수 있는 역할은 ADMIN과 USER뿐이다. ROOT로 바꾸는 요청은 거절한다(ROOT는 환경변수 ROOT_EMAIL로만 만든다).
 *  - ROOT 계정의 역할은 바꿀 수 없다(스스로 강등해서 운영자가 없어지는 일도 막는다).
 *  - 이미 그 역할이면 아무것도 하지 않는다(감사 로그도 남기지 않는다).
 * 차단 규칙
 *  - ROOT 계정은 차단할 수 없다(운영자가 없어지는 일을 막는다). 그래서 ROOT가 자기 자신을 차단하는 일도 없다.
 *  - 이미 그 상태면 아무것도 하지 않는다(감사 로그도 남기지 않는다).
 *  - 차단하면 로그인·재발급이 거부되고(UserAccountService, RefreshTokenService) 이미 발급된 Access Token도 다음 요청부터 무효다
 *    (JwtAuthenticationFilter가 요청마다 DB에서 상태를 읽고 ACTIVE만 인증한다). 유저 목록에서도 빠진다(ACTIVE만 공개).
 *    기록은 지우지 않는다(지우려면 D29의 기록 삭제를 쓴다). 차단을 풀면 기록 그대로 다시 쓴다.
 * 역할은 요청마다 DB에서 읽으므로(JwtAuthenticationFilter) 바꾸면 이미 발급된 Access Token에도 바로 반영된다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserAdminService {

    public static final int DEFAULT_PAGE_SIZE = 10;
    /** 검색어 최대 길이. 닉네임(30)·이메일 앞부분을 찾기에 충분하고, 터무니없이 긴 값은 잘라서 쓴다. */
    public static final int MAX_KEYWORD_LENGTH = 50;
    public static final int MAX_PAGE_SIZE = 100;

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    /** 사용자 목록. keyword가 비어 있으면 전체, 있으면 닉네임·이메일에 들어 있는 사람만(가입 순). */
    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> list(int page, int size, String keyword) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        PageRequest pageable = PageRequest.of(Math.max(page, 0), pageSize);
        String q = normalizeKeyword(keyword);
        if (q.isEmpty()) {
            return PageResponse.of(userRepository.findAllByOrderByIdAsc(pageable), AdminUserResponse::from);
        }
        return PageResponse.of(
                userRepository.findByNicknameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrderByIdAsc(q, q, pageable),
                AdminUserResponse::from);
    }

    private static String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return "";
        }
        String trimmed = keyword.strip();
        return trimmed.length() > MAX_KEYWORD_LENGTH ? trimmed.substring(0, MAX_KEYWORD_LENGTH) : trimmed;
    }

    public AdminUserResponse changeRole(Long actorId, Long userId, Role newRole) {
        if (newRole == Role.ROOT) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        User target = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        if (target.getRole() == Role.ROOT) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        if (target.getRole() == newRole) {
            return AdminUserResponse.from(target);
        }

        Role before = target.getRole();
        target.changeRole(newRole);

        // 이메일 같은 개인정보는 기록에 넣지 않는다. 누구인지는 target_id(사용자 id)로 찾는다.
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("before", before.name());
        detail.put("after", newRole.name());
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId),
                "USER_ROLE_CHANGE", "USER", String.valueOf(target.getId()), detail));
        return AdminUserResponse.from(target);
    }

    /** 계정을 차단(BLOCKED)하거나 차단을 푼다(ACTIVE). */
    public AdminUserResponse changeStatus(Long actorId, Long userId, UserStatus newStatus) {
        User target = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        if (target.getRole() == Role.ROOT) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        UserStatus before = target.getStatus();
        if (before == newStatus) {
            return AdminUserResponse.from(target);
        }

        if (newStatus == UserStatus.BLOCKED) {
            target.block();
        } else {
            target.activate();
        }

        // 이메일 같은 개인정보는 기록에 넣지 않는다. 누구인지는 target_id(사용자 id)로 찾는다.
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("before", before.name());
        detail.put("after", newStatus.name());
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId),
                newStatus == UserStatus.BLOCKED ? "USER_BLOCK" : "USER_UNBLOCK", "USER", String.valueOf(target.getId()), detail));
        return AdminUserResponse.from(target);
    }
}
