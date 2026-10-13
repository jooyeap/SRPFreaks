package com.srpfreaks.backend.security;

import com.srpfreaks.backend.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshCookieFactoryTest {

    private static final Instant T0 = Instant.parse("2026-10-05T00:00:00Z");

    private RefreshCookieFactory factory(boolean secure) {
        AppProperties props = new AppProperties();
        props.getCookie().setSecure(secure);
        return new RefreshCookieFactory(props, Clock.fixed(T0, ZoneOffset.UTC));
    }

    @Test
    void 보안_속성을_모두_갖는다() {
        ResponseCookie cookie = factory(true).create("raw", T0.plus(Duration.ofDays(14)));

        assertThat(cookie.getName()).isEqualTo("refresh_token");
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Strict");
        assertThat(cookie.getPath()).isEqualTo("/api/v1/auth");
        assertThat(cookie.getMaxAge()).isEqualTo(Duration.ofDays(14));
    }

    @Test
    void 로그아웃_쿠키는_값이_비고_즉시_만료된다() {
        ResponseCookie cookie = factory(true).clear();

        assertThat(cookie.getValue()).isEmpty();
        assertThat(cookie.getMaxAge()).isEqualTo(Duration.ZERO);
        assertThat(cookie.isHttpOnly()).isTrue();
    }

    @Test
    void 이미_지난_만료시각이면_maxAge는_0이다() {
        ResponseCookie cookie = factory(true).create("raw", T0.minusSeconds(5));

        assertThat(cookie.getMaxAge()).isEqualTo(Duration.ZERO);
    }
}
