package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 구글 로그인 요청. 프론트가 구글에서 받은 ID 토큰을 그대로 보낸다. */
public record GoogleLoginRequest(
        @NotBlank(message = "구글 토큰은 필수입니다.")
        @Size(max = 4096, message = "구글 토큰이 너무 깁니다.")
        String idToken) {
}
