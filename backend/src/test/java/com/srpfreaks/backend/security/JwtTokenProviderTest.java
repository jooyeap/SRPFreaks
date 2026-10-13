package com.srpfreaks.backend.security;

import com.srpfreaks.backend.config.JwtProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Access Token 발급/검증 규칙: 변조, 만료, 알고리즘, 토큰 종류, 발급자. */
class JwtTokenProviderTest {

    // HS256 키 최소 길이는 32바이트지만, HS512 바꿔치기 공격 테스트를 위해 64바이트로 만든다
    private static final String SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final Instant T0 = Instant.parse("2026-10-05T00:00:00Z");

    private SecretKey key;
    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        provider = providerAt(SECRET, T0);
    }

    private JwtTokenProvider providerAt(String secret, Instant now) {
        JwtProperties props = new JwtProperties();
        props.setSecret(secret);
        props.setIssuer("srpfreaks");
        props.setAccessTokenValidity(900_000L);
        props.setRefreshTokenValidity(1_209_600_000L);
        return new JwtTokenProvider(props, Clock.fixed(now, ZoneOffset.UTC));
    }

    /** 검증 규칙을 어기는 토큰을 직접 만들 때 쓰는 빌더(정상 값이 기본). */
    private String custom(String typ, String issuer, String subject, Instant exp) {
        return Jwts.builder()
                .issuer(issuer)
                .subject(subject)
                .claim("typ", typ)
                .issuedAt(Date.from(T0))
                .expiration(Date.from(exp))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    @Test
    void 발급한_토큰에서_사용자_id를_읽는다() {
        String token = provider.generateAccessToken(42L);

        assertThat(provider.parseAccessToken(token)).contains(42L);
    }

    @Test
    void 토큰에는_role이_들어_있지_않다() {
        String token = provider.generateAccessToken(42L);
        String payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);

        assertThat(payload).doesNotContain("role").doesNotContain("ROLE");
    }

    @Test
    void 만료_시각이_지나면_거부한다() {
        String token = provider.generateAccessToken(42L);

        assertThat(providerAt(SECRET, T0.plus(Duration.ofMinutes(14))).parseAccessToken(token)).contains(42L);
        assertThat(providerAt(SECRET, T0.plus(Duration.ofMinutes(16))).parseAccessToken(token)).isEmpty();
    }

    @Test
    void 다른_키로_서명한_토큰은_거부한다() {
        String other = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        String token = providerAt(other, T0).generateAccessToken(42L);

        assertThat(provider.parseAccessToken(token)).isEmpty();
    }

    @Test
    void 내용을_바꾼_토큰은_거부한다() {
        String[] parts = provider.generateAccessToken(42L).split("\\.");
        String forgedPayload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"sub\":\"1\",\"typ\":\"access\",\"iss\":\"srpfreaks\"}".getBytes(StandardCharsets.UTF_8));

        assertThat(provider.parseAccessToken(parts[0] + "." + forgedPayload + "." + parts[2])).isEmpty();
    }

    @Test
    void 서명이_없는_alg_none_토큰은_거부한다() {
        String header = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"sub\":\"1\",\"typ\":\"access\",\"iss\":\"srpfreaks\"}".getBytes(StandardCharsets.UTF_8));

        assertThat(provider.parseAccessToken(header + "." + payload + ".")).isEmpty();
    }

    @Test
    void 같은_키라도_HS256이_아닌_알고리즘은_거부한다() {
        String hs512 = Jwts.builder()
                .issuer("srpfreaks").subject("42").claim("typ", "access")
                .expiration(Date.from(T0.plusSeconds(600)))
                .signWith(key, Jwts.SIG.HS512)
                .compact();

        assertThat(provider.parseAccessToken(hs512)).isEmpty();
    }

    @Test
    void 종류가_access가_아닌_토큰은_거부한다() {
        String refreshTyped = custom("refresh", "srpfreaks", "42", T0.plusSeconds(600));
        String noType = custom(null, "srpfreaks", "42", T0.plusSeconds(600));

        assertThat(provider.parseAccessToken(refreshTyped)).isEmpty();
        assertThat(provider.parseAccessToken(noType)).isEmpty();
    }

    @Test
    void 발급자가_다르면_거부한다() {
        assertThat(provider.parseAccessToken(custom("access", "someone-else", "42", T0.plusSeconds(600)))).isEmpty();
    }

    @Test
    void 사용자_id가_숫자가_아니면_거부한다() {
        assertThat(provider.parseAccessToken(custom("access", "srpfreaks", "abc", T0.plusSeconds(600)))).isEmpty();
    }

    @Test
    void 비었거나_형식이_아닌_값과_너무_긴_값은_거부한다() {
        assertThat(provider.parseAccessToken(null)).isEmpty();
        assertThat(provider.parseAccessToken("")).isEmpty();
        assertThat(provider.parseAccessToken("not-a-jwt")).isEmpty();
        assertThat(provider.parseAccessToken("a".repeat(5000))).isEmpty();
    }

    @Test
    void Refresh_토큰_원문은_Access_토큰으로_통하지_않는다() {
        assertThat(provider.parseAccessToken(RefreshTokenCodec.generate())).isEmpty();
    }

    @Test
    void 서명_키가_32바이트보다_짧으면_시작을_실패시킨다() {
        assertThatThrownBy(() -> providerAt("too-short-secret", T0)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> providerAt(null, T0)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 유효_시간을_초_단위로_알려_준다() {
        assertThat(provider.accessTokenValiditySeconds()).isEqualTo(900L);
    }
}
