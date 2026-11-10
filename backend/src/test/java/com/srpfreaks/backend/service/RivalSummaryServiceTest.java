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

/** 라이벌 대시보드 집계 서비스(D67): 접근 규칙(404), 요청 값 검증(400), 목록 페이지·필터·정렬(달성률 차 기준), 한쪽만 기록한 곡 수. */
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

    private static SkillService.ScoredChart chart(long id, PatternType pattern, String score, String rate) {
        RatingCandidate c = new RatingCandidate(id, 100 + id, "곡" + id, "GUITAR", "MASTER", new BigDecimal("9.50"),
                new BigDecimal("5.6"), pattern.getLabel(), new BigDecimal(rate), false, null);
        return new SkillService.ScoredChart(c, pattern, new BigDecimal(score));
    }

    private void charts(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs) {
        Map<Long, List<SkillService.ScoredChart>> map = new LinkedHashMap<>();
        map.put(1L, mine);
        map.put(2L, theirs);
        when(skillService.scoredChartsAll(anyCollection())).thenReturn(map);
    }

    /** 삼중 곡 n개: 달성률 차가 -1.00, -2.00 ... 처럼 곡마다 다르게(곡 i의 차이 = -i%p). 점수 차도 같은 크기로 둔다(옛 필드). */
    private void tripleLosses(int n) {
        List<SkillService.ScoredChart> mine = new ArrayList<>();
        List<SkillService.ScoredChart> theirs = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            mine.add(chart(i, PatternType.TRIPLE, String.valueOf(200 - i) + ".00", (90 - i) + ".00"));
            theirs.add(chart(i, PatternType.TRIPLE, "200.00", "90.00"));
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
        assertThat(r.summary().scoreDiffSum()).isEqualByComparingTo("-6.00");   // 옛 필드(점수 차 합계)
        assertThat(r.summary().rateDiffAvg()).isEqualByComparingTo("-2.0");     // (-1 -2 -3) / 3 %p
        assertThat(r.filterCounts().all()).isEqualTo(3);
        assertThat(r.filterCounts().lose()).isEqualTo(3);
        assertThat(r.filterCounts().close()).isEqualTo(1);   // -1.00만 접전(경계 포함)
        assertThat(r.filterCounts().win()).isZero();
        assertThat(r.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(3L, 2L, 1L);
        assertThat(r.rows().content().get(0).rateDiff()).isEqualByComparingTo("-3.00");
    }

    @Test
    void 점수가_같아도_달성률이_다르면_달성률_차로_판정하고_정렬한다() {
        // 점수는 모두 304.00(95% 이상이라 같다)이지만 달성률 차는 곡마다 다르다
        charts(List.of(chart(1, PatternType.SINGLE, "304.00", "97.50"), chart(2, PatternType.SINGLE, "304.00", "99.80"),
                        chart(3, PatternType.SINGLE, "304.00", "99.00")),
                List.of(chart(1, PatternType.SINGLE, "304.00", "99.80"), chart(2, PatternType.SINGLE, "304.00", "99.80"),
                        chart(3, PatternType.SINGLE, "304.00", "98.50")));

        RivalSummaryResponse sum = service.summary(1L, 2L);
        RivalSummaryResponse.PatternSummary single = sum.patterns().get(0);
        assertThat(single.losses()).isEqualTo(1);    // 97.50 대 99.80
        assertThat(single.ties()).isEqualTo(1);      // 99.80 대 99.80
        assertThat(single.wins()).isEqualTo(1);      // 99.00 대 98.50
        assertThat(single.scoreDiffSum()).isEqualByComparingTo("0.00");

        RivalSummaryDetailResponse lose = service.detail(1L, 2L, "SINGLE", "LOSE", null, 0, 20);
        assertThat(lose.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(1L);
        assertThat(lose.rows().content().get(0).rateDiff()).isEqualByComparingTo("-2.30");
        RivalSummaryDetailResponse win = service.detail(1L, 2L, "SINGLE", "WIN", null, 0, 20);
        assertThat(win.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(3L);
        assertThat(service.detail(1L, 2L, "SINGLE", "CLOSE", null, 0, 20).rows().content())
                .extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(2L, 3L);   // 0.00, +0.50
    }

    @Test
    void 한쪽만_기록한_곡은_속성_요약에_곡_수로_들어가고_승무패에는_안_들어간다() {
        // 공유 1곡(삼중) + 상대만 3곡(삼중 2, 단일 1) + 나만 2곡(삼중 1, 이중 1)
        charts(List.of(chart(1, PatternType.TRIPLE, "200.00", "90.00"), chart(20, PatternType.TRIPLE, "100.00", "50.00"),
                        chart(21, PatternType.DOUBLE, "100.00", "40.00")),
                List.of(chart(1, PatternType.TRIPLE, "200.00", "88.00"), chart(10, PatternType.TRIPLE, "100.00", "70.00"),
                        chart(11, PatternType.TRIPLE, "100.00", "60.00"), chart(12, PatternType.SINGLE, "100.00", "80.00")));

        RivalSummaryResponse r = service.summary(1L, 2L);
        RivalSummaryResponse.PatternSummary triple = r.patterns().get(4);
        assertThat(triple.key()).isEqualTo("TRIPLE");
        assertThat(triple.sharedCount()).isEqualTo(1);
        assertThat(triple.wins()).isEqualTo(1);
        assertThat(triple.onlyTheirs()).isEqualTo(2);
        assertThat(triple.onlyMine()).isEqualTo(1);
        assertThat(r.patterns().get(0).onlyTheirs()).isEqualTo(1);   // 단일
        assertThat(r.patterns().get(3).onlyMine()).isEqualTo(1);     // 이중
        assertThat(r.totals().sharedCount()).isEqualTo(1);

        // 속성 상세 머리에도 같은 곡 수가 있다
        RivalSummaryDetailResponse d = service.detail(1L, 2L, "TRIPLE", null, null, 0, 20);
        assertThat(d.summary().onlyTheirs()).isEqualTo(2);
        assertThat(d.summary().onlyMine()).isEqualTo(1);
        assertThat(d.filterCounts().all()).isEqualTo(1);
    }

    @Test
    void 필터와_정렬을_적용하고_페이지로_나눈다() {
        tripleLosses(5);

        RivalSummaryDetailResponse close = service.detail(1L, 2L, "triple", "close", null, 0, 20);   // 달성률 차 -1.00만 접전
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

    // ---------- 2026-11-10: 속성별 점수 차 / 상대만 필터 / 난이도대별 ----------

    @Test
    void 요약의_속성별_점수_차는_레이팅_목록_속성별_합의_차이고_속성별_합이_총점_차와_같다() {
        tripleLosses(1);
        Map<PatternType, BigDecimal> mine = new java.util.EnumMap<>(PatternType.class);
        mine.put(PatternType.SINGLE, new BigDecimal("304.00"));
        mine.put(PatternType.TRIPLE, new BigDecimal("440.00"));
        Map<PatternType, BigDecimal> theirs = new java.util.EnumMap<>(PatternType.class);
        theirs.put(PatternType.SINGLE, new BigDecimal("240.00"));
        theirs.put(PatternType.TRIPLE, new BigDecimal("662.00"));
        Map<Long, Map<PatternType, BigDecimal>> lists = new LinkedHashMap<>();
        lists.put(1L, mine);
        lists.put(2L, theirs);
        when(skillService.ratingListScoreByPattern(org.mockito.ArgumentMatchers.anyMap())).thenReturn(lists);

        RivalSummaryResponse r = service.summary(1L, 2L);

        assertThat(r.patterns().stream().filter(p -> p.key().equals("SINGLE")).findFirst().orElseThrow().ratingScoreDiff())
                .isEqualByComparingTo("64.00");
        assertThat(r.patterns().stream().filter(p -> p.key().equals("TRIPLE")).findFirst().orElseThrow().ratingScoreDiff())
                .isEqualByComparingTo("-222.00");
        // 총점 차 = 내 총점 744.00 - 상대 총점 902.00 = -158.00 = 64.00 + (-222.00)
        BigDecimal sum = r.patterns().stream().map(RivalSummaryResponse.PatternSummary::ratingScoreDiff)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(sum).isEqualByComparingTo("-158.00");
    }

    @Test
    void 속성별_점수_차를_구하지_못하는_호출에서는_null이다() {
        tripleLosses(1);   // skillService.ratingListScoreByPattern은 mock이라 null을 돌려준다

        assertThat(service.summary(1L, 2L).patterns()).allSatisfy(p -> assertThat(p.ratingScoreDiff()).isNull());
    }

    @Test
    void 상대만_필터는_상대만_기록한_곡을_상대_달성률_높은_순으로_내_기록_없이_내려준다() {
        // 삼중: 둘 다 기록 1곡(id 1), 상대만 2곡(id 2: 85.00, id 3: 92.00), 나만 1곡(id 4). 이중에도 상대만 1곡(속성이 다르면 섞이지 않는다)
        charts(List.of(chart(1, PatternType.TRIPLE, "200.00", "90.00"), chart(4, PatternType.TRIPLE, "200.00", "70.00")),
                List.of(chart(1, PatternType.TRIPLE, "200.00", "90.00"), chart(2, PatternType.TRIPLE, "200.00", "85.00"),
                        chart(3, PatternType.TRIPLE, "200.00", "92.00"), chart(5, PatternType.DOUBLE, "200.00", "99.00")));

        RivalSummaryDetailResponse r = service.detail(1L, 2L, "TRIPLE", "THEIRS_ONLY", null, 0, 20);

        assertThat(r.filterCounts().theirsOnly()).isEqualTo(2);
        assertThat(r.filterCounts().all()).isEqualTo(1);            // 공유 곡은 1곡
        assertThat(r.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(3L, 2L);
        assertThat(r.rows().totalElements()).isEqualTo(2);
        RivalSummaryDetailResponse.Row first = r.rows().content().get(0);
        assertThat(first.rate()).isEqualByComparingTo("92.00");
        assertThat(first.myRate()).isNull();
        assertThat(first.myScore()).isNull();
        assertThat(first.rateDiff()).isNull();
        // 판정·평균은 공유 곡만(미플레이는 0%로 보지 않는다)
        assertThat(r.summary().sharedCount()).isEqualTo(1);
        assertThat(r.summary().onlyTheirs()).isEqualTo(2);
        assertThat(r.summary().onlyMine()).isEqualTo(1);
    }

    @Test
    void 상대만_필터는_곡명_정렬을_고를_수_있고_페이지를_나눈다() {
        charts(List.of(), List.of(chart(2, PatternType.TRIPLE, "200.00", "85.00"), chart(3, PatternType.TRIPLE, "200.00", "92.00"),
                chart(4, PatternType.TRIPLE, "200.00", "80.00")));

        RivalSummaryDetailResponse byTitle = service.detail(1L, 2L, "TRIPLE", "THEIRS_ONLY", "TITLE", 0, 2);
        RivalSummaryDetailResponse page2 = service.detail(1L, 2L, "TRIPLE", "THEIRS_ONLY", null, 1, 2);

        assertThat(byTitle.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(2L, 3L);
        assertThat(byTitle.rows().totalPages()).isEqualTo(2);
        assertThat(page2.rows().content()).extracting(RivalSummaryDetailResponse.Row::songDifficultyId).containsExactly(4L);   // 달성률 순: 92, 85 | 80
    }

    @Test
    void 속성_상세는_난이도대별_집계를_담고_공유_곡이_없는_난이도는_빈_줄이다() {
        charts(List.of(chart(1, PatternType.TRIPLE, "200.00", "96.00"), chart(2, PatternType.TRIPLE, "200.00", "80.00")),
                List.of(chart(1, PatternType.TRIPLE, "200.00", "94.00"), chart(2, PatternType.TRIPLE, "200.00", "84.00"),
                        tierChart(3, PatternType.TRIPLE, "5.5", "70.00")));

        RivalSummaryDetailResponse r = service.detail(1L, 2L, "TRIPLE", null, null, 0, 20);

        assertThat(r.tiers()).extracting(RivalSummaryDetailResponse.TierRow::tier).usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("5.6"), new BigDecimal("5.5"));
        assertThat(r.tiers().get(0).wins()).isEqualTo(1);
        assertThat(r.tiers().get(0).losses()).isEqualTo(1);
        assertThat(r.tiers().get(0).rateDiffAvg()).isEqualByComparingTo("-1.0");
        assertThat(r.tiers().get(1).sharedCount()).isZero();
        assertThat(r.tiers().get(1).rateDiffAvg()).isNull();
    }

    private static SkillService.ScoredChart tierChart(long id, PatternType pattern, String tier, String rate) {
        RatingCandidate c = new RatingCandidate(id, 100 + id, "곡" + id, "GUITAR", "MASTER", new BigDecimal("9.50"),
                new BigDecimal(tier), pattern.getLabel(), new BigDecimal(rate), false, null);
        return new SkillService.ScoredChart(c, pattern, new BigDecimal("200.00"));
    }
}
