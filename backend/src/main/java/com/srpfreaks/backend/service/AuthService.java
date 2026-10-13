package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.security.GoogleIdentity;
import com.srpfreaks.backend.security.GoogleTokenVerifier;
import com.srpfreaks.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 로그인 / 재발급 / 로그아웃의 흐름을 엮는다.
 * 이 클래스에는 @Transactional을 붙이지 않는다. 구글 키 서버를 부르는 네트워크 대기 동안 DB 연결을 붙잡지 않도록,
 * 검증은 트랜잭션 밖에서 하고 DB 작업은 각 서비스가 자기 트랜잭션으로 처리한다.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final GoogleTokenVerifier googleTokenVerifier;
    private final UserAccountService userAccountService;
    private final RefreshTokenService refreshTokenService;
    private final JwtTokenProvider jwtTokenProvider;

    /** 컨트롤러가 응답으로 바꿀 결과. Access Token은 본문으로, Refresh Token은 쿠키로 내려간다. */
    public record LoginResult(User user, String accessToken, long expiresInSeconds,
                              RefreshTokenService.IssuedToken refreshToken) {
    }

    public LoginResult loginWithGoogle(String idToken) {
        GoogleIdentity identity = googleTokenVerifier.verify(idToken);
        User user = userAccountService.findOrCreate(identity);
        return result(user, refreshTokenService.issueForNewLogin(user));
    }

    public LoginResult refresh(String rawRefreshToken) {
        RefreshTokenService.Rotation rotation = refreshTokenService.rotate(rawRefreshToken);
        return result(rotation.user(), rotation.token());
    }

    public void logout(String rawRefreshToken) {
        refreshTokenService.revokeFamilyOf(rawRefreshToken);
    }

    private LoginResult result(User user, RefreshTokenService.IssuedToken refreshToken) {
        return new LoginResult(user, jwtTokenProvider.generateAccessToken(user.getId()),
                jwtTokenProvider.accessTokenValiditySeconds(), refreshToken);
    }
}
