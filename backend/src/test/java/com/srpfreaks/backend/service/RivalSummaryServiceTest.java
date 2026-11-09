package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.RivalSummaryDetailResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.RatingCandidate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 라이벌 대시보드 집계 서비스(D67): 접근 규칙(404), 요청 값 검증(400), 목록 페이지·필터·정렬. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RivalSummaryServiceTest {

    @Mock RivalService rivalService;
    @Mock SkillService skillService;

    RivalSummaryService service;
    User target;

    @BeforeEach
    void setUp() {
        service = new RivalSummaryService(rivalService, skillService);
        target = User.create("sub-2", "rival@example.com", "Rumi");
        ReflectionTestUtils.setField(target, "id", 2L);
        when(rivalService.findComparable(1L, 2L)).thenReturn(target);
    }

    private static SkillService.ScoredChart chart(long id, PatternType pattern, String score) {
        RatingCandidate c = new RatingCandidate(id, 100 + id, "곡" + id, "GUITAR", "MASTER", new BigDecimal("9.50"),
                new BigDecimal("5.6"), pattern.getLabel(), new BigDecimal("90.00"), false, null);
        return new SkillService.ScoredChart(c, pattern, new BigDecimal(score));
    }

    private void charts(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs) {
        Map<Long, List<SkillService.ScoredChart>> map = new LinkedHashMap<>();
        map.put(1L, mine);
        map.put(2L, theirs);
        when(skillService.scoredChartsAll(anyCollection())).thenReturn(map);
    }

    /** 삼중 곡 n개: 차이가 -n.00 ... 처럼 곡마다 다르게(곡 i의 차이 = -i). */
    private void tripleLosses(int n) {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            mine.add(chart(i, PatternType.TRIPLE, String.valueOf(200 - i) + ".00"));
            theirs.add(chart(i, PatternType.TRIPLE, "200.00"));
        }
        charts(mine, theirs);
    }

    // ---------- 접근 ----------

    @Test
    void 상대가_공개_유저가_아니면_404로_막고_계산하지_않는다() {
        when(rivalService.findComparable(1L, 9L)).thenThrow(new ApiException(ErrorCode.NOT_FOUND));

        assertThatThrownBy(() -> service.summary(1L, 9L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        assertThatThrownBy(() -> service.detail(1L, 9L, "SINGLE", null, null, 0, 20)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(skillService, never()).scoredChartsAll(anyCollection());
    }

    @Test
    void 요약은_상대_닉네임만_담고_두_사람의_채보_점수를_한_번에_읽는다() {
        tripleLosses(3);

        RivalSummaryResponse r = service.summary(1L, 2L);

        assertThat(r.userId()).isEqualTo(2L);
        assertThat(r.nickname()).isEqualTo("Rumi");
        assertThat(r.totals().losses()).isEqualTo(3);
        verify(skillService).scoredChartsAll(List.of(1L, 2L));   // 쿼리는 사람당 한 번(N+1 없음)
    }

    // ---------- 요청 값 검증 ----------

    @Test
    void 허용_밖의_속성_필터_정렬은_400이다() {
        tripleLosses(1);

        for (Object[] bad : new Object[][]{{"EXCLUDED", null, null}, {"레이팅 제외", null, null}, {"SINGLE", "LOSING", null},
                {"SINGLE", null, "title; drop"}}) {
            assertThatThrownBy(() -> service.detail(1L, 2L, (String) bad[0], (String) bad[1], (String) bad[2], 0, 20))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));
        }
    }

    // ---------- 곡 목록 ----------

    @Test
    void 기본은_많이_뒤진_순이고_머리에_속성_요약과_필터_곡_수가_있다() {
        tripleLosses(3);

        RivalSummaryDetailResponse r = service.detail(1L, 2L, "TRIPLE", null, null, 0, 20);

        assertThat(r.summary().key()).isEqualTo("TRIPLE");
        assertThat(r.summary().sharedCount()).isEqualTo(3);
        assertThat(r.summary().scoreDiffSum()).isEqualByComparingTo("-6.00");
        assertThat(r.filterCounts().all()).isEqualTo(3);
        assertThat(r.filterCounts().lose()).isEqualTo(3);
        assertThat(r.filterCounts().close()).isEqualTo(1);   // -1.00만 접전(경계 포함)
        assertThat(r.filterCounts().win()).isZero();
        assertThat(r.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(3L, 2L, 1L);
    }

    @Test
    void 필터와_정렬을_적용하고_페이지로_나눈다() {
        tripleLosses(5);

        RivalSummaryDetailResponse close = service.detail(1L, 2L, "triple", "close", null, 0, 20);
        assertThat(close.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(1L);

        RivalSummaryDetailResponse page = service.detail(1L, 2L, "TRIPLE", "LOSE", "DIFF_DESC", 1, 2);
        assertThat(page.rows().totalElements()).isEqualTo(5);
        assertThat(page.rows().totalPages()).isEqualTo(3);
        assertThat(page.rows().page()).isEqualTo(1);
        assertThat(page.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(3L, 4L);
    }

    @Test
    void 페이지_크기는_1에서_50으로_맞춘다_범위_밖_페이지는_빈_목록() {
        tripleLosses(3);

        assertThat(service.detail(1L, 2L, "TRIPLE", null, null, 0, 1000).rows().size()).isEqualTo(50);
        assertThat(service.detail(1L, 2L, "TRIPLE", null, null, 0, 0).rows().size()).isEqualTo(1);
        assertThat(service.detail(1L, 2L, "TRIPLE", null, null, -5, 20).rows().page()).isZero();
        assertThat(service.detail(1L, 2L, "TRIPLE", null, null, 99, 20).rows().content()).isEmpty();
    }

    @Test
    void 공유_곡이_없는_속성도_빈_목록으로_답한다() {
        tripleLosses(2);

        RivalSummaryDetailResponse r = service.detail(1L, 2L, "SINGLE", null, null, 0, 20);

        assertThat(r.summary().sharedCount()).isZero();
        assertThat(r.rows().content()).isEmpty();
        assertThat(r.rows().totalPages()).isZero();
        assertThat(r.filterCounts().all()).isZero();
    }

    @Test
    void 속성_키는_대소문자를_가리지_않는다() {
        tripleLosses(1);
        assertThat(service.detail(1L, 2L, "Triple", null, null, 0, 20).summary().sharedCount()).isEqualTo(1);
    }
}
