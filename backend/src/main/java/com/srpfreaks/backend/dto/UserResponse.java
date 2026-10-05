package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;

import java.time.Instant;

/** 사용자 응답. googleSub 같은 내부 식별자는 내보내지 않는다. */
public record UserResponse(Long id, String email, String nickname, Role role, Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getNickname(), user.getRole(), user.getCreatedAt());
    }
}
