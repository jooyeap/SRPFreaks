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
}
