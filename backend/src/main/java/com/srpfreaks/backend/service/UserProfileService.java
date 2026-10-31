package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.UserResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/** 로그인한 본인의 프로필(닉네임) 변경과 탈퇴. */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    /** 닉네임 변경 로그의 작업 종류(audit_logs.action). 화면 이름은 프론트 lib/admin.ts의 ACTION_LABELS */
    public static final String ACTION_NICKNAME_CHANGE = "NICKNAME_CHANGE";

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    /**
     * 본인 닉네임을 바꾼다. 대상은 토큰에서 나온 userId뿐이다(다른 사용자의 닉네임은 바꿀 수 없다).
     * 규칙에 어긋나면 User.changeNickname이 IllegalArgumentException을 던지고, 공통 예외 처리가 400으로 응답한다.
     * 별도 save 호출이 없는 이유: 트랜잭션 안에서 조회한 엔티티는 변경 감지(dirty checking)로 커밋 때 UPDATE된다.
     */
    @Transactional
    public UserResponse updateNickname(Long userId, String nickname) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        String before = user.getNickname();
        user.changeNickname(nickname);
        String after = user.getNickname();
        // 실제로 바뀐 때만 남긴다(같은 값으로 저장하면 로그가 쌓이지 않는다). 정규화한 뒤의 값을 비교한다.
        if (!Objects.equals(before, after)) {
            // 닉네임 변경은 ROOT/ADMIN의 관리 작업이 아니라 사용자 본인의 작업이다. 악용(비방 닉네임으로 바꿨다 되돌리기 등)을
            // 나중에 ROOT가 감사 로그에서 확인할 수 있게 둔다. 이메일은 넣지 않고 누구인지는 actor·target_id(사용자 id)로 찾는다.
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("before", before);
            detail.put("after", after);
            auditLogRepository.save(AuditLog.record(user, ACTION_NICKNAME_CHANGE, "USER", String.valueOf(user.getId()), detail));
        }
        return UserResponse.from(user);
    }

    /**
     * 유저 목록 공개 여부를 바꾼다(D26). 대상은 토큰에서 나온 userId뿐이다.
     * 공개로 바꾸려면 닉네임이 있어야 하며, 없으면 User가 IllegalArgumentException을 던져 400이 된다.
     */
    @Transactional
    public UserResponse updateProfilePublic(Long userId, boolean profilePublic) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        user.changeProfilePublic(profilePublic);
        return UserResponse.from(user);
    }

    /** `라이벌 알림 받기`(D56). 끄면 나에게 오는 역전 알림만 멈춘다. */
    @Transactional
    public UserResponse updateRivalNotify(Long userId, boolean enabled) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        user.changeRivalNotify(enabled);
        return UserResponse.from(user);
    }

    /**
     * 탈퇴 = 완전 삭제(D20). users 행 하나만 지우면 된다.
     * 나머지는 DB 외래키가 처리한다(V1__init_schema.sql):
     *  - option_records, refresh_tokens, skill_snapshots, rivals, rival_notifications: ON DELETE CASCADE라 같이 지워진다(기록·토큰이 남지 않는다).
     *  - audit_logs.actor_id, songs.created_by, app_settings.updated_by: ON DELETE SET NULL이라 행은 남고 사용자 식별만 사라진다.
     * 그래서 대부분은 여기서 일일이 지우지 않는다(코드로 지우면 빠뜨릴 수 있고, FK가 이미 같은 규칙을 보장한다).
     * 예외: 닉네임 변경 로그는 닉네임 글자(detail)가 남으므로 직접 지운다(D48). 나머지 감사 로그에는 사용자 id·역할 같은 값만 있다.
     * 대상은 토큰에서 나온 userId뿐이라 남의 계정은 지울 수 없다.
     */
    @Transactional
    public void withdraw(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        auditLogRepository.deleteByActionAndTargetTypeAndTargetId(ACTION_NICKNAME_CHANGE, "USER", String.valueOf(userId));
        userRepository.delete(user);
    }
}
