package com.srpfreaks.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 구글 ID 토큰 클레임 검증: 정상 토큰만 통과하고, 대상·발급자·이메일 확인 중 하나라도 어긋나면 거부한다. */
class GoogleClaimsValidatorTest {

    private static final String CLIENT_ID = "my-client-id.apps.googleusercontent.com";

    private final GoogleClaimsValidator validator = new GoogleClaimsValidator(CLIENT_ID);

    /** 정상 값으로 시작해서 필요한 부분만 바꿔 가며 만든다. */
    private Jwt jwt(Consumer<Jwt.Builder> customize) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .issuedAt(Instant.parse("2026-10-05T00:00:00Z"))
                .expiresAt(Instant.parse("2026-10-05T01:00:00Z"))
                .claim("iss", "https://accounts.google.com")
                .audience(List.of(CLIENT_ID))
                .subject("1234567890")
                .claim("email", "a@example.com")
                .claim("email_verified", true);
        customize.accept(builder);
        return builder.build();
    }

    private boolean passes(Consumer<Jwt.Builder> customize) {
        OAuth2TokenValidatorResult result = validator.validate(jwt(customize));
        return !result.hasErrors();
    }

    @Test
    void 정상_토큰은_통과한다() {
        assertThat(passes(b -> { })).isTrue();
    }

    @Test
    void 발급자_표기는_두_가지_모두_허용한다() {
        assertThat(passes(b -> b.claim("iss", "accounts.google.com"))).isTrue();
    }

    @Test
    void 다른_발급자는_거부한다() {
        assertThat(passes(b -> b.claim("iss", "https://evil.example.com"))).isFalse();
    }

    @Test
    void 우리_클라이언트_ID가_대상이_아니면_거부한다() {
        assertThat(passes(b -> b.audience(List.of("other-app.apps.googleusercontent.com")))).isFalse();
    }

    @Test
    void 대상이_여러_개여도_우리_ID가_들어_있으면_통과한다() {
        assertThat(passes(b -> b.audience(List.of("other", CLIENT_ID)))).isTrue();
    }

    @Test
    void 대상이_없으면_거부한다() {
        assertThat(passes(b -> b.claims(c -> c.remove("aud")))).isFalse();
    }

    @Test
    void 이메일_확인이_안_됐으면_거부한다() {
        assertThat(passes(b -> b.claim("email_verified", false))).isFalse();
        assertThat(passes(b -> b.claims(c -> c.remove("email_verified")))).isFalse();
    }

    @Test
    void 이메일_확인값이_문자열_true여도_통과한다() {
        assertThat(passes(b -> b.claim("email_verified", "true"))).isTrue();
    }

    @Test
    void 이메일이나_sub가_없으면_거부한다() {
        assertThat(passes(b -> b.claims(c -> c.remove("email")))).isFalse();
        assertThat(passes(b -> b.claim("email", " "))).isFalse();
        assertThat(passes(b -> b.claims(c -> c.remove("sub")))).isFalse();
    }

    @Test
    void 클라이언트_ID가_비어_있으면_시작을_실패시킨다() {
        assertThatThrownBy(() -> new GoogleClaimsValidator(" ")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new GoogleClaimsValidator(null)).isInstanceOf(IllegalStateException.class);
    }
}
