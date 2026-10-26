package com.srpfreaks.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties {

    /** 서명 키(환경변수 JWT_SECRET). HS256이라 32바이트(256비트) 이상이어야 한다. */
    private String secret;
    private String issuer = "srpfreaks";
    private long accessTokenValidity;   // ms 단위 (15분 = 900000)
    private long refreshTokenValidity;  // ms 단위
    /**
     * 재사용 탐지 유예(ms, D50). 토큰이 폐기(Rotation)된 지 이 시간 안에 같은 토큰이 다시 오면 "도난"으로 보지 않고
     * 그 요청만 거절한다(로그인 전체는 폐기하지 않는다). 탭 여러 개가 같은 쿠키로 동시에 재발급할 때 정상 사용자의 로그인이
     * 풀리지 않게 하려는 값이다. 0이면 유예 없이 예전처럼 곧바로 family를 폐기한다. 기본 10초.
     */
    private long refreshReuseGrace = 10_000;
}
