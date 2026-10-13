package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.ImportTokenIssueResponse;
import com.srpfreaks.backend.dto.ImportTokenStatusResponse;
import com.srpfreaks.backend.entity.ImportToken;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.ImportTokenRepository;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.security.RefreshTokenCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 가져오기 토큰: 발급(해시만 저장, 이전 토큰 폐기), 폐기, 상태, 인증(실패 이유를 구분하지 않는다). */
@ExtendWith(MockitoExtension.class)
class ImportTokenServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-13T00:00:00Z");
    private static final Instant CREATED = Instant.parse("2026-10-13T00:00:01Z");

    @Mock ImportTokenRepository repository;
    @Mock UserRepository userRepository;

    ImportTokenService service;
    User user;

    @BeforeEach
    void setUp() {
        service = new ImportTokenService(repository, userRepository, Clock.fixed(NOW, ZoneOffset.UTC));
        user = User.create("sub-1", "a@example.com", null);
        ReflectionTestUtils.setField(user, "id", 7L);
    }

    private ImportToken stored(String raw) {
        return ImportToken.issue(user, RefreshTokenCodec.hash(raw));
    }

    @Test
    void 발급하면_이전_토큰을_먼저_폐기하고_해시만_저장하며_원문은_접두어가_붙는다() {
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(repository.save(any(ImportToken.class))).thenAnswer(inv -> {
            ImportToken t = inv.getArgument(0);
            ReflectionTestUtils.setField(t, "createdAt", CREATED);
            return t;
        });

        ImportTokenIssueResponse response = service.issue(7L);

        assertThat(response.token()).startsWith("srpi_").hasSize(5 + 43);
        assertThat(response.createdAt()).isEqualTo(CREATED);
        InOrder order = inOrder(repository);
        order.verify(repository).revokeAllActiveOf(7L, NOW);
        ArgumentCaptor<ImportToken> saved = ArgumentCaptor.forClass(ImportToken.class);
        order.verify(repository).save(saved.capture());
        // DB에는 원문이 아니라 해시만 들어간다
        assertThat(saved.getValue().getTokenHash()).isEqualTo(RefreshTokenCodec.hash(response.token()));
        assertThat(saved.getValue().getTokenHash()).doesNotContain(response.token());
    }

    @Test
    void 발급할_때마다_다른_토큰이_나온다() {
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(repository.save(any(ImportToken.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.issue(7L).token()).isNotEqualTo(service.issue(7L).token());
    }

    @Test
    void 없는_사용자는_발급할_수_없다() {
        when(userRepository.findById(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.issue(7L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED));
        verify(repository, never()).save(any());
    }

    @Test
    void 폐기는_내_살아_있는_토큰을_모두_폐기한다() {
        service.revoke(7L);

        verify(repository).revokeAllActiveOf(7L, NOW);
    }

    @Test
    void 상태는_토큰이_있으면_시각만_알려_주고_없으면_없다고_알린다() {
        ImportToken t = stored("srpi_x");
        ReflectionTestUtils.setField(t, "createdAt", CREATED);
        t.markUsed(NOW);
        when(repository.findFirstByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(t));
        when(repository.findFirstByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(8L)).thenReturn(Optional.empty());

        assertThat(service.status(7L)).isEqualTo(new ImportTokenStatusResponse(true, CREATED, NOW));
        assertThat(service.status(8L)).isEqualTo(ImportTokenStatusResponse.none());
    }

    @Test
    void 올바른_토큰이면_사용자_id를_돌려주고_마지막_사용_시각을_갱신한다() {
        String raw = "srpi_" + RefreshTokenCodec.generate();
        ImportToken t = stored(raw);
        when(repository.findByTokenHash(RefreshTokenCodec.hash(raw))).thenReturn(Optional.of(t));

        assertThat(service.authenticate(raw)).contains(7L);
        assertThat(t.getLastUsedAt()).isEqualTo(NOW);
    }

    @Test
    void 폐기된_토큰은_인증되지_않는다() {
        String raw = "srpi_" + RefreshTokenCodec.generate();
        ImportToken t = stored(raw);
        t.revoke(NOW);
        when(repository.findByTokenHash(RefreshTokenCodec.hash(raw))).thenReturn(Optional.of(t));

        assertThat(service.authenticate(raw)).isEmpty();
        assertThat(t.getLastUsedAt()).isNull();
    }

    @Test
    void 없는_토큰은_인증되지_않는다() {
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThat(service.authenticate("srpi_" + RefreshTokenCodec.generate())).isEmpty();
    }

    @Test
    void 접두어가_없거나_너무_길거나_비어_있으면_DB를_보지_않고_거부한다() {
        assertThat(service.authenticate(null)).isEmpty();
        assertThat(service.authenticate("")).isEmpty();
        // 로그인 토큰(refresh)을 가져오기 경로에 넣어도 통하지 않는다
        assertThat(service.authenticate(RefreshTokenCodec.generate())).isEmpty();
        assertThat(service.authenticate("srpi_" + "a".repeat(200))).isEmpty();
        verify(repository, never()).findByTokenHash(any());
    }

    @Test
    void 차단된_사용자의_토큰은_인증되지_않는다() {
        String raw = "srpi_" + RefreshTokenCodec.generate();
        user.block();
        when(repository.findByTokenHash(RefreshTokenCodec.hash(raw))).thenReturn(Optional.of(stored(raw)));

        assertThat(service.authenticate(raw)).isEmpty();
        verify(repository, never()).revokeAllActiveOf(eq(7L), any());
    }
}
