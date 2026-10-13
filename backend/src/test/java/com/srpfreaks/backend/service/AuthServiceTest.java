package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.config.JwtProperties;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.security.GoogleIdentity;
import com.srpfreaks.backend.security.GoogleTokenVerifier;
import com.srpfreaks.backend.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** 로그인/재발급/로그아웃 흐름이 각 서비스를 올바른 순서로 부르는지. */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-05T00:00:00Z");

    @Mock GoogleTokenVerifier googleTokenVerifier;
    @Mock UserAccountService userAccountService;
    @Mock RefreshTokenService refreshTokenService;

    JwtTokenProvider jwtTokenProvider;
    AuthService service;
    User user;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret("0123456789abcdef0123456789abcdef0123456789abcdef");
        props.setIssuer("srpfreaks");
        props.setAccessTokenValidity(900_000L);
        jwtTokenProvider = new JwtTokenProvider(props, Clock.fixed(NOW, ZoneOffset.UTC));
        service = new AuthService(googleTokenVerifier, userAccountService, refreshTokenService, jwtTokenProvider);
        user = User.create("sub-1", "a@example.com", null);
        ReflectionTestUtils.setField(user, "id", 7L);
    }

    @Test
    void 구글_로그인이_성공하면_Access_Token과_Refresh_Token을_준다() {
        GoogleIdentity identity = new GoogleIdentity("sub-1", "a@example.com");
        RefreshTokenService.IssuedToken refresh = new RefreshTokenService.IssuedToken("raw-refresh", NOW.plusSeconds(100));
        when(googleTokenVerifier.verify("id-token")).thenReturn(identity);
        when(userAccountService.findOrCreate(identity)).thenReturn(user);
        when(refreshTokenService.issueForNewLogin(user)).thenReturn(refresh);

        AuthService.LoginResult result = service.loginWithGoogle("id-token");

        assertThat(jwtTokenProvider.parseAccessToken(result.accessToken())).contains(7L);
        assertThat(result.expiresInSeconds()).isEqualTo(900L);
        assertThat(result.refreshToken()).isSameAs(refresh);
        assertThat(result.user()).isSameAs(user);
    }

    @Test
    void 구글_토큰_검증에_실패하면_계정도_토큰도_만들지_않는다() {
        when(googleTokenVerifier.verify("bad")).thenThrow(new ApiException(ErrorCode.AUTH_FAILED));

        assertThatThrownBy(() -> service.loginWithGoogle("bad")).isInstanceOf(ApiException.class);

        verifyNoInteractions(userAccountService, refreshTokenService);
    }

    @Test
    void 재발급하면_새_Access_Token과_회전된_Refresh_Token을_준다() {
        RefreshTokenService.IssuedToken next = new RefreshTokenService.IssuedToken("raw-next", NOW.plusSeconds(100));
        when(refreshTokenService.rotate("raw-old")).thenReturn(new RefreshTokenService.Rotation(user, next));

        AuthService.LoginResult result = service.refresh("raw-old");

        assertThat(jwtTokenProvider.parseAccessToken(result.accessToken())).contains(7L);
        assertThat(result.refreshToken()).isSameAs(next);
    }

    @Test
    void 로그아웃은_Refresh_Token_폐기를_맡긴다() {
        service.logout("raw");

        verify(refreshTokenService).revokeFamilyOf("raw");
    }
}
