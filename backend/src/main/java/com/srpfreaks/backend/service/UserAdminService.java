package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.AdminUserResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 사용자 관리 (ROOT 전용): 목록 조회와 역할 변경.
 *
 * 역할 변경 규칙 (권한 상승을 막는다)
 *  - 바꿀 수 있는 역할은 ADMIN과 USER뿐이다. ROOT로 바꾸는 요청은 거절한다(ROOT는 환경변수 ROOT_EMAIL로만 만든다).
 *  - ROOT 계정의 역할은 바꿀 수 없다(스스로 강등해서 운영자가 없어지는 일도 막는다).
 *  - 이미 그 역할이면 아무것도 하지 않는다(감사 로그도 남기지 않는다).
 * 역할은 요청마다 DB에서 읽으므로(JwtAuthenticationFilter) 바꾸면 이미 발급된 Access Token에도 바로 반영된다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserAdminService {

    public static final int DEFAULT_PAGE_SIZE = 30;
    public static final int MAX_PAGE_SIZE = 100;

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> list(int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        return PageResponse.of(userRepository.findAllByOrderByIdAsc(PageRequest.of(pageIndex, pageSize)),
                AdminUserResponse::from);
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
}
