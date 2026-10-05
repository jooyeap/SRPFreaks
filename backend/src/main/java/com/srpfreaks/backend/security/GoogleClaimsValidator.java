package com.srpfreaks.backend.security;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Set;

/**
 * 구글 ID 토큰의 클레임 검증. 서명과 만료는 디코더가 따로 검증하므로 여기서는 "누구를 위해, 누가 발급했는지"를 본다.
 *
 * - iss: 구글이 발급한 토큰인가 (구글은 두 가지 표기를 쓴다)
 * - aud: 우리 클라이언트 ID를 대상으로 한 토큰인가. 이것을 안 보면 다른 서비스용으로 발급된 구글 토큰으로도 로그인된다.
 * - email, email_verified: 구글이 이메일 소유를 확인한 계정인가. 확인 안 된 이메일로 가입을 허용하면 남의 이메일로 가장할 수 있다.
 */
public class GoogleClaimsValidator implements OAuth2TokenValidator<Jwt> {

    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");

    private final String clientId;

    public GoogleClaimsValidator(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            // 클라이언트 ID 없이 뜨면 aud 검증이 무의미해지므로 시작 단계에서 멈춘다
            throw new IllegalStateException("GOOGLE_CLIENT_ID가 설정되어 있지 않습니다.");
        }
        this.clientId = clientId;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        // jwt.getIssuer()는 URL로 파싱하려 해서 "accounts.google.com" 표기에서 실패하므로 문자열로 직접 읽는다
        if (!ISSUERS.contains(jwt.getClaimAsString("iss"))) {
            return fail("발급자가 올바르지 않습니다.");
        }
        List<String> audience = jwt.getAudience();
        if (audience == null || !audience.contains(clientId)) {
            return fail("대상이 올바르지 않습니다.");
        }
        if (isBlank(jwt.getSubject()) || isBlank(jwt.getClaimAsString("email"))) {
            return fail("필수 정보가 없습니다.");
        }
        Object verified = jwt.getClaim("email_verified");
        if (!(Boolean.TRUE.equals(verified) || "true".equals(verified))) {
            return fail("확인되지 않은 이메일입니다.");
        }
        return OAuth2TokenValidatorResult.success();
    }

    private static OAuth2TokenValidatorResult fail(String description) {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", description, null));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
