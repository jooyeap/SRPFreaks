package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.AuthResponse;
import com.srpfreaks.backend.dto.GoogleLoginRequest;
import com.srpfreaks.backend.security.OriginPolicy;
import com.srpfreaks.backend.security.RefreshCookieFactory;
import com.srpfreaks.backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인(구글) / 재발급 / 로그아웃. 세 경로 모두 로그인 전에 부르므로 공개 경로이고, RateLimit이 걸린다. */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RefreshCookieFactory cookieFactory;
    private final OriginPolicy originPolicy;

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> google(@Valid @RequestBody GoogleLoginRequest request) {
        AuthService.LoginResult result = authService.loginWithGoogle(request.idToken());
        return withRefreshCookie(result);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            HttpServletRequest request,
            @CookieValue(name = RefreshCookieFactory.COOKIE_NAME, required = false) String refreshToken) {
        originPolicy.requireAllowed(request);
        if (refreshToken == null) {
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
        return withRefreshCookie(authService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest request,
            @CookieValue(name = RefreshCookieFactory.COOKIE_NAME, required = false) String refreshToken) {
        originPolicy.requireAllowed(request);
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookieFactory.clear().toString())
                .build();
    }

    private ResponseEntity<AuthResponse> withRefreshCookie(AuthService.LoginResult result) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        cookieFactory.create(result.refreshToken().rawToken(), result.refreshToken().expiresAt()).toString())
                .body(AuthResponse.from(result));
    }
}
