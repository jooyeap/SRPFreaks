package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;

import java.time.Instant;

/** 관리 화면(ROOT 전용)의 사용자 한 줄. 이메일은 ROOT가 누구인지 알아보는 데 필요해서 넣고, Google ID(sub)는 넣지 않는다. */
public record AdminUserResponse(Long id, String email, String nickname, Role role, UserStatus status, Instant createdAt) {

    public static AdminUserResponse from(User user) {
        return new AdminUserResponse(user.getId(), user.getEmail(), user.getNickname(), user.getRole(),
                user.getStatus(), user.getCreatedAt());
    }
}
