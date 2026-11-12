package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.NotRatedReason;
import com.srpfreaks.backend.dto.RatingSimulationResponse;
import com.srpfreaks.backend.dto.RatingSimulationResponse.Status;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.mapper.ChartRatingRow;
import com.srpfreaks.backend.mapper.RatingCandidate;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 시뮬레이션 서비스: 채보 없음(404), 레이팅 대상 아님 판정, 본인 기록만 읽는지. 계산 자체는 RatingSimulatorTest가 검증한다. */
@ExtendWith(MockitoExtension.class)
class RatingSimulationServiceTest {

    private static final long USER = 7L;
    private static final long CHART = 10L;

    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock SkillService skillService;

    private RatingSimulationService service() {
        return new RatingSimulationService(songDifficultyRepository, skillService);
    }

    private void chartExists() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(CHART)).thenReturn(Optional.of(mock(SongDifficulty.class)));
        when(skillService.ratingConfig()).thenReturn(RatingCalculatorTest.defaults());
    }

    private static ChartRatingRow row(Long entryId, String tier, String pattern, Boolean enabled, String best) {
        return new ChartRatingRow(CHART, entryId, tier == null ? null : new BigDecimal(tier), pattern, enabled,
                best == null ? null : new BigDecimal(best));
    }

    @Test
    void 없거나_삭제된_채보는_404다() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(CHART)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().simulate(USER, CHART, null))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(skillService, never()).scoredChartsAll(any());
    }

    @Test
    void 기준_난이도가_없으면_레이팅_대상이_아니라서_계산하지_않는다() {
        chartExists();
        when(skillService.chartRatingRow(USER, CHART, RatingCalculatorTest.defaults())).thenReturn(row(1L, null, "단일", true, "90.00"));

        RatingSimulationResponse r = service().simulate(USER, CHART, new BigDecimal("95.00"));

        assertThat(r.status()).isEqualTo(Status.NOT_RATED);
        assertThat(r.notRatedReason()).isEqualTo(NotRatedReason.TIER_UNDECIDED);
        assertThat(r.cutline()).isNull();
        assertThat(r.simulation()).isNull();
        verify(skillService, never()).scoredChartsAll(any());
    }

    @Test
    void 속성이_없거나_레이팅_제외이면_대상이_아니다() {
        chartExists();
        when(skillService.chartRatingRow(USER, CHART, RatingCalculatorTest.defaults()))
                .thenReturn(row(1L, "6.0", PatternType.EXCLUDED.getLabel(), true, null))
                .thenReturn(row(1L, "6.0", null, true, null));

        assertThat(service().simulate(USER, CHART, null).notRatedReason()).isEqualTo(NotRatedReason.EXCLUDED);
        assertThat(service().simulate(USER, CHART, null).notRatedReason()).isEqualTo(NotRatedReason.EXCLUDED);
    }

    @Test
    void 서열표에_없거나_레이팅_반영을_끈_채보는_대상이_아니다() {
        chartExists();
        when(skillService.chartRatingRow(USER, CHART, RatingCalculatorTest.defaults()))
                .thenReturn(row(null, null, null, null, null))
                .thenReturn(row(1L, "6.0", "단일", false, null));

        assertThat(service().simulate(USER, CHART, null).notRatedReason()).isEqualTo(NotRatedReason.EXCLUDED);
        assertThat(service().simulate(USER, CHART, null).notRatedReason()).isEqualTo(NotRatedReason.EXCLUDED);
    }

    @Test
    void 대상_채보는_토큰의_본인_기록만으로_계산한다() {
        chartExists();
        when(skillService.chartRatingRow(USER, CHART, RatingCalculatorTest.defaults())).thenReturn(row(1L, "6.0", "단일", true, null));
        RatingCandidate other = new RatingCandidate(1L, 101L, "곡1", "GUITAR", "MASTER", new BigDecimal("9.50"),
                new BigDecimal("6.0"), "단일", new BigDecimal("100.00"), false, null);
        when(skillService.scoredChartsAll(List.of(USER)))
                .thenReturn(java.util.Map.of(USER, List.of(new SkillService.ScoredChart(other, PatternType.SINGLE, new BigDecimal("304")))));

        RatingSimulationResponse r = service().simulate(USER, CHART, new BigDecimal("95.00"));

        assertThat(r.status()).isEqualTo(Status.NO_RECORD);
        assertThat(r.group()).isEqualTo(com.srpfreaks.backend.entity.PatternType.RatingGroup.SINGLE);
        assertThat(r.simulation().scoreAfter()).isEqualByComparingTo("304.00");
        // 다른 사용자의 id로는 읽지 않는다
        verify(skillService).scoredChartsAll(List.of(USER));
    }
}
