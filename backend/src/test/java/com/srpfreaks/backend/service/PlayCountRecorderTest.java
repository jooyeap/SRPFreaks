package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.PlayCountCursor;
import com.srpfreaks.backend.repository.ChartPlayCountRepository;
import com.srpfreaks.backend.repository.PlayCountCursorRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 플레이 횟수 집계 규칙(D84)을 Mockito로 확인한다. 실제 upsert·삭제 동작은 ChartPlayCountRepositoryTest(MySQL)에서 본다. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlayCountRecorderTest {

    static final Long USER = 7L;
    static final Instant NOW = Instant.parse("2026-11-15T00:00:00Z");
    static final Instant T1 = Instant.parse("2026-11-14T10:00:00Z");
    static final Instant T2 = Instant.parse("2026-11-14T10:10:00Z");
    static final Instant T3 = Instant.parse("2026-11-14T10:20:00Z");

    @Mock ChartPlayCountRepository countRepository;
    @Mock PlayCountCursorRepository cursorRepository;
    @Mock PlatformTransactionManager transactionManager;
    @Mock TransactionStatus transactionStatus;

    PlayCountRecorder recorder;
    PlayCountCursor cursor;

    @BeforeEach
    void setUp() {
        when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);
        recorder = new PlayCountRecorder(countRepository, cursorRepository, transactionManager, Clock.fixed(NOW, ZoneOffset.UTC));
        cursor = BeanUtils.instantiateClass(PlayCountCursor.class);
        ReflectionTestUtils.setField(cursor, "userId", USER);
        when(cursorRepository.findForUpdate(USER)).thenReturn(Optional.of(cursor));
    }

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private static PlayCountRecorder.PlayedChart play(long chartId, Instant at) {
        return new PlayCountRecorder.PlayedChart(chartId, at);
    }

    private void cursorAt(Instant at) {
        ReflectionTestUtils.setField(cursor, "lastCountedAt", at);
    }

    // ---- 가져오기 ----

    @Test
    void 커서가_비어_있으면_요청의_모든_플레이를_세고_커서를_가장_늦은_시각으로_옮긴다() {
        recorder.recordImported(USER, List.of(play(1, T1), play(1, T3), play(2, T2)));

        verify(countRepository).addPlays(USER, 1L, 2, T3); // 채보 1: 두 번, 마지막 시각은 늦은 쪽
        verify(countRepository).addPlays(USER, 2L, 1, T2);
        assertThat(cursor.getLastCountedAt()).isEqualTo(T3);
    }

    @Test
    void 같은_플레이를_다시_가져오면_두_번_세지_않는다() {
        cursorAt(T3); // 첫 가져오기가 끝난 뒤의 커서

        recorder.recordImported(USER, List.of(play(1, T1), play(1, T3), play(2, T2)));

        verify(countRepository, never()).addPlays(anyLong(), anyLong(), anyInt(), any());
        assertThat(cursor.getLastCountedAt()).isEqualTo(T3);
    }

    @Test
    void 커서보다_엄격히_늦은_플레이만_센다_같은_시각은_이미_센_것이다() {
        cursorAt(T2);

        recorder.recordImported(USER, List.of(play(1, T1), play(1, T2), play(1, T3)));

        verify(countRepository).addPlays(USER, 1L, 1, T3);
        assertThat(cursor.getLastCountedAt()).isEqualTo(T3);
    }

    @Test
    void 커서는_뒤로_가지_않는다() {
        cursorAt(T3);

        recorder.recordImported(USER, List.of(play(1, T1)));            // 전부 이전 시각: 셀 것 없음
        assertThat(cursor.getLastCountedAt()).isEqualTo(T3);

        cursor.advanceTo(T1);                                           // 엔티티 규칙: 더 이른 시각은 무시
        assertThat(cursor.getLastCountedAt()).isEqualTo(T3);
    }

    @Test
    void 한_요청의_같은_채보_같은_시각_줄은_한_번만_센다() {
        recorder.recordImported(USER, List.of(play(1, T1), play(1, T1), play(1, T2)));

        verify(countRepository).addPlays(USER, 1L, 2, T2); // T1 한 번 + T2 한 번
    }

    @Test
    void 센_것이_없으면_빈_목록은_아무것도_하지_않는다() {
        recorder.recordImported(USER, List.of());

        verify(cursorRepository, never()).ensureExists(anyLong());
        verify(countRepository, never()).addPlays(anyLong(), anyLong(), anyInt(), any());
    }

    // ---- 직접·사진 입력 ----

    @Test
    void 새_기록은_그_채보를_하나_올리고_커서는_건드리지_않는다() {
        cursorAt(T1);

        recorder.recordCreated(USER, 5L, T3);

        verify(countRepository).addPlays(USER, 5L, 1, T3);
        verify(cursorRepository, never()).ensureExists(anyLong());
        verify(cursorRepository, never()).findForUpdate(anyLong());
        assertThat(cursor.getLastCountedAt()).isEqualTo(T1);
    }

    @Test
    void 플레이_시각이_없으면_지금으로_센다() {
        recorder.recordCreated(USER, 5L, null);

        verify(countRepository).addPlays(USER, 5L, 1, NOW);
    }

    // ---- 실패 격리 ----

    @Test
    void 가져오기_집계가_실패해도_예외를_던지지_않고_자기_트랜잭션만_롤백한다() {
        when(countRepository.addPlays(anyLong(), anyLong(), anyInt(), any())).thenThrow(new IllegalStateException("db down"));

        assertThatCode(() -> recorder.recordImported(USER, List.of(play(1, T1)))).doesNotThrowAnyException();

        verify(transactionManager).rollback(transactionStatus);
        verify(transactionManager, never()).commit(any());
    }

    @Test
    void 직접_입력_집계가_실패해도_예외를_던지지_않는다() {
        when(countRepository.addPlays(anyLong(), anyLong(), anyInt(), any())).thenThrow(new IllegalStateException("db down"));

        assertThatCode(() -> recorder.recordCreated(USER, 5L, T1)).doesNotThrowAnyException();
    }

    // ---- 커밋 뒤에 센다 ----

    @Test
    void 트랜잭션_안에서_부르면_커밋_뒤에야_센다() {
        TransactionSynchronizationManager.initSynchronization();

        recorder.recordCreated(USER, 5L, T1);
        verify(countRepository, never()).addPlays(anyLong(), anyLong(), anyInt(), any()); // 아직 저장이 확정되기 전

        // 커밋되면 등록된 afterCommit이 불린다(롤백이면 불리지 않으므로 세지 않는다)
        List<TransactionSynchronization> syncs = TransactionSynchronizationManager.getSynchronizations();
        assertThat(syncs).hasSize(1);
        syncs.forEach(TransactionSynchronization::afterCommit);
        verify(countRepository).addPlays(USER, 5L, 1, T1);
    }

    @Test
    void 커밋_뒤_집계가_실패해도_afterCommit에서_예외가_나가지_않는다() {
        when(countRepository.addPlays(anyLong(), anyLong(), anyInt(), any())).thenThrow(new IllegalStateException("db down"));
        TransactionSynchronizationManager.initSynchronization();

        recorder.recordCreated(USER, 5L, T1);

        assertThatCode(() -> TransactionSynchronizationManager.getSynchronizations()
                .forEach(TransactionSynchronization::afterCommit)).doesNotThrowAnyException();
    }
}
