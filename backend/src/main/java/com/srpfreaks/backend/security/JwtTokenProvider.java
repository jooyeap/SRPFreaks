package com.srpfreaks.backend.security;

import com.srpfreaks.backend.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/**
 * Access Token(JWT) 발급과 검증.
 *
 * 보안 규칙
 * - 알고리즘은 HS256 하나로 고정한다. 서명이 맞아도 헤더의 alg가 HS256이 아니면 거부한다(알고리즘 바꿔치기 방지).
 * - 토큰 종류 클레임 typ가 "access"인 것만 받는다. Refresh 토큰은 JWT가 아니라 무작위 문자열이라 여기서 파싱조차 되지 않는다.
 * - 토큰에는 사용자 id만 넣고 role은 넣지 않는다. 권한은 요청마다 DB에서 읽어서, 권한 회수와 차단이 바로 반영된다.
 * - 서명 키가 짧으면(32바이트 미만) 서버 시작을 실패시킨다.
 */
@Component
public class JwtTokenProvider {

    public static final String TOKEN_TYPE_CLAIM = "typ";
    public static final String ACCESS_TOKEN_TYPE = "access";

    private static final int MIN_SECRET_BYTES = 32;
    /** 비정상적으로 긴 토큰은 파싱하지 않고 바로 거부한다. */
    private static final int MAX_TOKEN_LENGTH = 2048;

    private final JwtProperties properties;
    private final Clock clock;
    private final SecretKey key;

    public JwtTokenProvider(JwtProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
        String secret = properties.getSecret();
        byte[] bytes = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MIN_SECRET_BYTES) {
            // 짧은 키는 무차별 대입에 약하다. 약한 설정으로 조용히 뜨는 것보다 시작 단계에서 멈추는 쪽이 안전하다.
            throw new IllegalStateException("JWT_SECRET은 " + MIN_SECRET_BYTES + "바이트 이상이어야 합니다.");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public String generateAccessToken(Long userId) {
        Instant now = clock.instant();
        return Jwts.builder()
                .issuer(properties.getIssuer())
                .subject(String.valueOf(userId))
                .claim(TOKEN_TYPE_CLAIM, ACCESS_TOKEN_TYPE)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(properties.getAccessTokenValidity())))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public long accessTokenValiditySeconds() {
        return properties.getAccessTokenValidity() / 1000;
    }

    /**
     * 유효한 Access Token이면 사용자 id를 돌려준다. 어떤 이유로든 실패하면 빈 값이다(이유를 구분하지 않는다).
     */
    public Optional<Long> parseAccessToken(String token) {
        if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH) {
            return Optional.empty();
        }
        try {
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(properties.getIssuer())
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token);
            if (!"HS256".equals(jws.getHeader().getAlgorithm())) {
                return Optional.empty();
            }
            Claims claims = jws.getPayload();
            if (!ACCESS_TOKEN_TYPE.equals(claims.get(TOKEN_TYPE_CLAIM, String.class))) {
                return Optional.empty();
            }
            return Optional.of(Long.valueOf(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException e) {
            // 서명 불일치, 만료, 형식 오류, 숫자가 아닌 sub 모두 같은 결과. 토큰 내용은 로그에 남기지 않는다.
            return Optional.empty();
        }
    }
}
