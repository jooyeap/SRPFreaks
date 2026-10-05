package com.srpfreaks.backend.security;

import com.srpfreaks.backend.config.AppProperties;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Refresh Token 쿠키를 만든다.
 * httpOnly: 자바스크립트가 읽지 못한다(XSS로 훔치기 어렵다).
 * Secure: https에서만 전송(로컬 http 개발에서만 COOKIE_SECURE=false).
 * SameSite=Strict: 다른 사이트에서 시작된 요청에는 쿠키를 붙이지 않는다.
 * Path=/api/v1/auth: 재발급/로그아웃 경로로만 쿠키가 가고, 일반 API 요청에는 실리지 않는다.
 */
@Component
public class RefreshCookieFactory {

    public static final String COOKIE_NAME = "refresh_token";
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final AppProperties properties;
    private final Clock clock;

    public RefreshCookieFactory(AppProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public ResponseCookie create(String rawToken, Instant expiresAt) {
        Duration maxAge = Duration.between(clock.instant(), expiresAt);
        return base(rawToken).maxAge(maxAge.isNegative() ? Duration.ZERO : maxAge).build();
    }

    /** 로그아웃 때 브라우저의 쿠키를 지운다(같은 속성에 maxAge=0). */
    public ResponseCookie clear() {
        return base("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(properties.getCookie().isSecure())
                .sameSite("Strict")
                .path(COOKIE_PATH);
    }
}
