package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.SetlistEventType;
import com.srpfreaks.backend.repository.SetlistEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SetlistEventRecorderTest {

    /** UTC 10-10 15:30 = 서울 10-11 00:30. "하루"가 서울 날짜로 세어지는지 보려고 자정을 넘긴 시각으로 고정한다 */
    static final Instant NOW = Instant.parse("2026-10-10T15:30:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 10, 11);

    @Mock SetlistEventRepository eventRepository;
    @Mock PlayLevelEstimator playLevelEstimator;

    SetlistEventRecorder recorder;

    @BeforeEach
    void setUp() {
        recorder = new SetlistEventRecorder(eventRepository, playLevelEstimator, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void 서울_날짜와_그때의_평균_난이도를_함께_저장한다() {
        when(playLevelEstimator.estimate(1L)).thenReturn(PlayLevelEstimate.ready(new BigDecimal("6.25"), 15, 25));

        recorder.record(1L, 10L, SetlistEventType.ADD);

        verify(eventRepository).insertIfAbsent(eq(1L), eq(10L), eq("ADD"), eq(TODAY), eq(new BigDecimal("6.25")));
    }

    @Test
    void 평균을_구할_수_없는_사용자는_평균_난이도를_비워서_저장한다() {
        when(playLevelEstimator.estimate(1L)).thenReturn(PlayLevelEstimate.newPlayer());

        recorder.record(1L, 10L, SetlistEventType.REMOVE);

        verify(eventRepository).insertIfAbsent(eq(1L), eq(10L), eq("REMOVE"), eq(TODAY), isNull());
    }

    @Test
    void 기록_부족이어도_평균_난이도만_비우고_이력은_남긴다() {
        when(playLevelEstimator.estimate(1L)).thenReturn(PlayLevelEstimate.insufficient(2, 3));

        recorder.record(1L, 10L, SetlistEventType.ADD);

        verify(eventRepository).insertIfAbsent(eq(1L), eq(10L), eq("ADD"), eq(TODAY), isNull());
    }

    @Test
    void 평균_계산이_실패해도_이력은_남기고_예외를_밖으로_던지지_않는다() {
        when(playLevelEstimator.estimate(1L)).thenThrow(new IllegalStateException("boom"));

        assertThatCode(() -> recorder.record(1L, 10L, SetlistEventType.ADD)).doesNotThrowAnyException();

        verify(eventRepository).insertIfAbsent(eq(1L), eq(10L), eq("ADD"), eq(TODAY), isNull());
    }

    @Test
    void 이력_저장이_실패해도_예외를_밖으로_던지지_않는다() {
        when(playLevelEstimator.estimate(1L)).thenReturn(PlayLevelEstimate.newPlayer());
        when(eventRepository.insertIfAbsent(any(), any(), any(), any(), any())).thenThrow(new IllegalStateException("db down"));

        assertThatCode(() -> recorder.record(1L, 10L, SetlistEventType.ADD)).doesNotThrowAnyException();
    }
}
