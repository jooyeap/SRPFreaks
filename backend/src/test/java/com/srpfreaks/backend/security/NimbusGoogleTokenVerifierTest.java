package com.srpfreaks.backend.security;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 디코더(서명 검증)는 가짜로 대체하고, 검증기가 결과를 어떻게 다루는지 본다. */
class NimbusGoogleTokenVerifierTest {

    private static Jwt jwt() {
        return Jwt.withTokenValue("t").header("alg", "RS256")
                .issuedAt(Instant.parse("2026-10-05T00:00:00Z")).expiresAt(Instant.parse("2026-10-05T01:00:00Z"))
                .subject("1234567890").claim("email", "User@Example.COM").build();
    }

    private static void assertAuthFailed(Throwable thrown) {
        assertThat(thrown).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.AUTH_FAILED));
    }

    @Test
    void 검증을_통과하면_sub와_소문자_이메일을_돌려준다() {
        NimbusGoogleTokenVerifier verifier = new NimbusGoogleTokenVerifier(token -> jwt());

        GoogleIdentity identity = verifier.verify("some-id-token");

        assertThat(identity.sub()).isEqualTo("1234567890");
        assertThat(identity.email()).isEqualTo("user@example.com");
    }

    @Test
    void 서명이나_클레임_검증에_실패하면_AUTH_FAILED() {
        NimbusGoogleTokenVerifier verifier = new NimbusGoogleTokenVerifier(token -> {
            throw new BadJwtException("서명 불일치");
        });

        assertThatThrownBy(() -> verifier.verify("some-id-token")).satisfies(NimbusGoogleTokenVerifierTest::assertAuthFailed);
    }

    @Test
    void 키_서버_장애_같은_예기치_않은_오류도_같은_AUTH_FAILED로_응답한다() {
        NimbusGoogleTokenVerifier verifier = new NimbusGoogleTokenVerifier(token -> {
            throw new IllegalStateException("연결 실패");
        });

        assertThatThrownBy(() -> verifier.verify("some-id-token")).satisfies(NimbusGoogleTokenVerifierTest::assertAuthFailed);
    }

    @Test
    void 비었거나_너무_긴_토큰은_디코더를_부르지_않고_거부한다() {
        NimbusGoogleTokenVerifier verifier = new NimbusGoogleTokenVerifier(token -> {
            throw new AssertionError("디코더가 호출되면 안 된다");
        });

        assertThatThrownBy(() -> verifier.verify(null)).satisfies(NimbusGoogleTokenVerifierTest::assertAuthFailed);
        assertThatThrownBy(() -> verifier.verify(" ")).satisfies(NimbusGoogleTokenVerifierTest::assertAuthFailed);
        assertThatThrownBy(() -> verifier.verify("a".repeat(5000))).satisfies(NimbusGoogleTokenVerifierTest::assertAuthFailed);
    }
}
