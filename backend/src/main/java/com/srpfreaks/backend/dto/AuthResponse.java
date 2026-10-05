package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.service.AuthService;

/** 로그인/재발급 응답. Refresh Token은 본문에 없고 httpOnly 쿠키로만 내려간다. */
public record AuthResponse(String accessToken, String tokenType, long expiresIn, UserResponse user) {

    public static AuthResponse from(AuthService.LoginResult result) {
        return new AuthResponse(result.accessToken(), "Bearer", result.expiresInSeconds(),
                UserResponse.from(result.user()));
    }
}
