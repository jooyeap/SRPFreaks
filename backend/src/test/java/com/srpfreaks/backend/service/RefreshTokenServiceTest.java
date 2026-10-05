package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.config.JwtProperties;
import com.srpfreaks.backend.entity.RefreshToken;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.RefreshTokenRepository;
import com.srpfreaks.backend.security.RefreshTokenCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Rotation, 재사용 탐지, 만료·차단 처리. 실패 이유는 모두 AUTH_FAILED 하나여야 한다. */
@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-05T00:00:00Z");
    private static final String FAMILY = "11111111-1111-1111-1111-111111111111";

    @Mock
    RefreshTokenRepository repository;

    RefreshTokenService service;
    User user;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setRefreshTokenValidity(Duration.ofDays(14).toMillis());
        service = new RefreshTokenService(repository, props, Clock.fixed(NOW, ZoneOffset.UTC));
        user = User.create("sub-1", "a@example.com", null);
    }

    private RefreshToken stored(String raw, Instant expiresAt) {
        return RefreshToken.issue(user, FAMILY, RefreshTokenCodec.hash(raw), expiresAt);
    }

    private static void assertAuthFailed(Throwable thrown) {
        assertThat(thrown).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.AUTH_FAILED));
    }

    @Test
    void 새_로그인은_원문이_아니라_해시만_저장한다() {
        RefreshTokenService.IssuedToken issued = service.issueForNewLogin(user);

        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getTokenHash()).isEqualTo(RefreshTokenCodec.hash(issued.rawToken()));
        assertThat(saved.getValue().getTokenHash()).isNotEqualTo(issued.rawToken());
        assertThat(saved.getValue().getExpiresAt()).isEqualTo(NOW.plus(Duration.ofDays(14)));
        assertThat(saved.getValue().getFamilyId()).hasSize(36);
        assertThat(issued.expiresAt()).isEqualTo(NOW.plus(Duration.ofDays(14)));
    }

    @Test
    void 재발급하면_기존_토큰을_폐기하고_같은_family로_새_토큰을_준다() {
        String raw = RefreshTokenCodec.generate();
        RefreshToken current = stored(raw, NOW.plusSeconds(600));
        when(repository.findForUpdateByTokenHash(RefreshTokenCodec.hash(raw))).thenReturn(Optional.of(current));

        RefreshTokenService.Rotation rotation = service.rotate(raw);

        assertThat(current.isRevoked()).isTrue();
        assertThat(rotation.token().rawToken()).isNotEqualTo(raw);
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getFamilyId()).isEqualTo(FAMILY);
        assertThat(saved.getValue().getTokenHash()).isEqualTo(RefreshTokenCodec.hash(rotation.token().rawToken()));
        assertThat(rotation.user()).isSameAs(user);
    }

    @Test
    void 모르는_토큰은_거부한다() {
        when(repository.findForUpdateByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rotate(RefreshTokenCodec.generate())).satisfies(RefreshTokenServiceTest::assertAuthFailed);
        verify(repository, never()).save(any());
    }

    @Test
    void 이미_쓴_토큰이_다시_오면_같은_family를_모두_폐기하고_거부한다() {
        String raw = RefreshTokenCodec.generate();
        RefreshToken used = stored(raw, NOW.plusSeconds(600));
        used.revoke(NOW.minusSeconds(60));
        when(repository.findForUpdateByTokenHash(RefreshTokenCodec.hash(raw))).thenReturn(Optional.of(used));

        assertThatThrownBy(() -> service.rotate(raw)).satisfies(RefreshTokenServiceTest::assertAuthFailed);

        verify(repository).revokeFamily(FAMILY, NOW);
        verify(repository, never()).save(any());
    }

    @Test
    void 만료된_토큰은_거부한다() {
        String raw = RefreshTokenCodec.generate();
        when(repository.findForUpdateByTokenHash(RefreshTokenCodec.hash(raw)))
                .thenReturn(Optional.of(stored(raw, NOW)));

        assertThatThrownBy(() -> service.rotate(raw)).satisfies(RefreshTokenServiceTest::assertAuthFailed);
        verify(repository, never()).save(any());
    }

    @Test
    void 차단된_사용자의_토큰은_family를_폐기하고_거부한다() {
        user.block();
        String raw = RefreshTokenCodec.generate();
        when(repository.findForUpdateByTokenHash(RefreshTokenCodec.hash(raw)))
                .thenReturn(Optional.of(stored(raw, NOW.plusSeconds(600))));

        assertThatThrownBy(() -> service.rotate(raw)).satisfies(RefreshTokenServiceTest::assertAuthFailed);

        verify(repository).revokeFamily(FAMILY, NOW);
        verify(repository, never()).save(any());
    }

    @Test
    void 비었거나_너무_긴_값은_DB를_조회하지_않고_거부한다() {
        assertThatThrownBy(() -> service.rotate(null)).satisfies(RefreshTokenServiceTest::assertAuthFailed);
        assertThatThrownBy(() -> service.rotate(" ")).satisfies(RefreshTokenServiceTest::assertAuthFailed);
        assertThatThrownBy(() -> service.rotate("a".repeat(500))).satisfies(RefreshTokenServiceTest::assertAuthFailed);

        verifyNoInteractions(repository);
    }

    @Test
    void 로그아웃하면_같은_family를_폐기한다() {
        String raw = RefreshTokenCodec.generate();
        when(repository.findByTokenHash(RefreshTokenCodec.hash(raw))).thenReturn(Optional.of(stored(raw, NOW.plusSeconds(600))));

        service.revokeFamilyOf(raw);

        verify(repository).revokeFamily(FAMILY, NOW);
    }

    @Test
    void 로그아웃할_때_토큰이_없거나_모르는_값이어도_조용히_끝난다() {
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        service.revokeFamilyOf(RefreshTokenCodec.generate());
        service.revokeFamilyOf(null);

        verify(repository, never()).revokeFamily(anyString(), any());
    }
}
