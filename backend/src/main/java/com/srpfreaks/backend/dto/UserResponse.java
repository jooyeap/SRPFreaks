package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;

import java.time.Instant;

/** 본인 정보 응답(내 정보). googleSub 같은 내부 식별자는 내보내지 않는다. 다른 사람에게 보여 주는 응답은 PlayerSummaryResponse를 쓴다. */
public record UserResponse(Long id, String email, String nickname, Role role, boolean profilePublic, Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getNickname(), user.getRole(), user.isProfilePublic(),
                user.getCreatedAt());
    }
}
