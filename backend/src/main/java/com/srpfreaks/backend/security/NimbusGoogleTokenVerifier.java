package com.srpfreaks.backend.security;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Locale;

/**
 * 구글 ID 토큰 검증 구현. 구글이 공개한 키(JWKS)로 서명을 확인한다(키는 라이브러리가 캐시한다).
 * 서명 알고리즘은 RS256으로 고정하고, 만료와 iss/aud/email_verified를 함께 검증한다.
 * 실패하면 이유를 구분하지 않고 AUTH_FAILED 하나로 응답한다. 토큰 원문은 로그에 남기지 않는다.
 */
@Slf4j
@Component
public class NimbusGoogleTokenVerifier implements GoogleTokenVerifier {

    private static final String GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final int MAX_TOKEN_LENGTH = 4096;

    private final JwtDecoder decoder;

    // 생성자가 두 개라 스프링이 어느 쪽을 쓸지 알 수 있도록 @Autowired로 지정한다.
    // 다른 생성자에 위임(this(...))하지 않고 직접 대입해 생성자 호출이 꼬일 여지를 없앤다.
    @Autowired
    public NimbusGoogleTokenVerifier(AppProperties properties) {
        this.decoder = buildDecoder(properties.getGoogle().getClientId());
    }

    /** 테스트에서 가짜 디코더를 넣기 위한 생성자. */
    NimbusGoogleTokenVerifier(JwtDecoder decoder) {
        this.decoder = decoder;
    }

    private static JwtDecoder buildDecoder(String clientId) {
        // 구글 키 서버가 느려도 로그인 요청이 오래 매달리지 않게 타임아웃을 건다
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(3));

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(GOOGLE_JWKS_URI)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .restOperations(new RestTemplate(requestFactory))
                .build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ofSeconds(60)),   // 서버 간 시계 오차 60초까지 허용
                new GoogleClaimsValidator(clientId)));
        return decoder;
    }

    @Override
    public GoogleIdentity verify(String idToken) {
        if (idToken == null || idToken.isBlank() || idToken.length() > MAX_TOKEN_LENGTH) {
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
        try {
            Jwt jwt = decoder.decode(idToken);
            return new GoogleIdentity(jwt.getSubject(), jwt.getClaimAsString("email").toLowerCase(Locale.ROOT));
        } catch (JwtException e) {
            log.warn("구글 토큰 검증 실패: {}", e.getClass().getSimpleName());
            throw new ApiException(ErrorCode.AUTH_FAILED);
        } catch (RuntimeException e) {
            // 키 서버 연결 실패 등. 사용자에게는 같은 응답을 주고 원인은 서버 로그에만 남긴다.
            log.error("구글 토큰 검증 중 예외", e);
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
    }
}
