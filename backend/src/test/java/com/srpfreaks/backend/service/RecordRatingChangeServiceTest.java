package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.NotRatedReason;
import com.srpfreaks.backend.dto.RatingChangeResponse;
import com.srpfreaks.backend.dto.RecordResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType.RatingGroup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecordRatingChangeServiceTest {

    static final long USER = 7L;
    static final long CHART = 42L;

    @Mock SkillService skillService;
    RecordRatingChangeService service;

    @BeforeEach
    void setUp() {
        service = new RecordRatingChangeService(skillService);
    }

    private static SkillEntryResponse entry(long chartId) {
        return new SkillEntryResponse(1, chartId, chartId, "곡", null, null, null, null, "단일", null, false, null, null, null, null);
    }

    private static SkillResponse skill(String total, SkillEntryResponse... singles) {
        return new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(total), new BigDecimal(total), BigDecimal.ZERO,
                null, 15, 25, List.of(singles), List.of());
    }

    private static RecordResponse saved() {
        return new RecordResponse(1L, CHART, 1L, "곡", null, null, null, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal("95.00"),
                false, null, null, null, null, null, null, null);
    }

    @Test
    void 목록에_새로_들어가면_entered이고_합계_차이를_돌려준다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.00", entry(1)), skill("103.40", entry(1), entry(CHART)));

        RecordResponse result = service.withChange(USER, CHART, RecordRatingChangeServiceTest::saved);

        RatingChangeResponse change = result.ratingChange();
        assertThat(change.entered()).isTrue();
        assertThat(change.inList()).isTrue();
        assertThat(change.change()).isEqualByComparingTo("3.40");
        assertThat(change.totalBefore()).isEqualByComparingTo("100.00");
        assertThat(change.totalAfter()).isEqualByComparingTo("103.40");
    }

    @Test
    void 이미_목록에_있던_곡이_오르면_entered가_아니다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.00", entry(CHART)), skill("101.00", entry(CHART)));

        RatingChangeResponse change = service.withChange(USER, CHART, RecordRatingChangeServiceTest::saved).ratingChange();

        assertThat(change.entered()).isFalse();
        assertThat(change.inList()).isTrue();
        assertThat(change.change()).isEqualByComparingTo("1.00");
    }

    @Test
    void 목록_밖의_곡이면_inList가_false이고_레이팅은_그대로다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.00", entry(1)), skill("100.00", entry(1)));

        RatingChangeResponse change = service.withChange(USER, CHART, RecordRatingChangeServiceTest::saved).ratingChange();

        assertThat(change.inList()).isFalse();
        assertThat(change.entered()).isFalse();
        assertThat(change.change()).isEqualByComparingTo("0.00");
    }

    @Test
    void 기록을_낮게_고치면_음수_변화가_나온다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.00", entry(CHART)), skill("98.50", entry(CHART)));

        assertThat(service.withChange(USER, CHART, RecordRatingChangeServiceTest::saved).ratingChange().change())
                .isEqualByComparingTo("-1.50");
    }

    @Test
    void 레이팅_계산이_실패해도_저장_응답은_그대로_돌려주고_변화만_비운다() {
        when(skillService.mySkill(USER)).thenThrow(new IllegalStateException("계산 실패"));

        RecordResponse result = service.withChange(USER, CHART, RecordRatingChangeServiceTest::saved);

        assertThat(result.id()).isEqualTo(1L);
        assertThat(result.ratingChange()).isNull();
    }

    // ---------- 카드용 상세 필드 (직접 계산한 예시값: T=6.0 -> R=15, A=95 -> V=15.2 -> 304.00, A=80 -> 240.00) ----------

    private static SkillEntryResponse scored(int rank, long chartId, String score) {
        return new SkillEntryResponse(rank, chartId, chartId, "곡", null, null, null, null, "단일", null, false, null, null, null,
                new BigDecimal(score));
    }

    private static SkillResponse full(String total, int singleLimit, SkillEntryResponse... singles) {
        return new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(total), new BigDecimal(total), BigDecimal.ZERO,
                null, singleLimit, 25, List.of(singles), List.of());
    }

    private static RecordResponse savedWith(String rate) {
        return new RecordResponse(1L, CHART, 1L, "곡", null, null, null, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(rate),
                false, null, null, null, null, null, null, null);
    }

    private static ChartRating rated(RatingGroup group, String best, String score) {
        return new ChartRating(null, group, new BigDecimal(best), new BigDecimal(score));
    }

    @Test
    void 이전_최고_80에서_95를_저장하면_점수_전후와_새_최고가_나온다() {
        when(skillService.mySkill(USER)).thenReturn(skill("240.00", scored(1, CHART, "240.00")),
                skill("304.00", scored(1, CHART, "304.00")));
        when(skillService.chartRating(USER, CHART)).thenReturn(rated(RatingGroup.SINGLE, "80.00", "240.00"),
                rated(RatingGroup.SINGLE, "95.00", "304.00"));

        RatingChangeResponse c = service.withChange(USER, CHART, () -> savedWith("95.00")).ratingChange();

        assertThat(c.scoreBefore()).isEqualByComparingTo("240.00");
        assertThat(c.scoreAfter()).isEqualByComparingTo("304.00");
        assertThat(c.newBest()).isTrue();
        assertThat(c.loweredBest()).isFalse();
        assertThat(c.previousBestRate()).isEqualByComparingTo("80.00");
        assertThat(c.notRatedReason()).isNull();
        assertThat(c.group()).isEqualTo(RatingGroup.SINGLE);
        assertThat(c.rank()).isEqualTo(1);
        assertThat(c.groupLimit()).isEqualTo(15);
        assertThat(c.pointsToList()).isNull();
        // 기존 필드는 그대로
        assertThat(c.totalBefore()).isEqualByComparingTo("240.00");
        assertThat(c.change()).isEqualByComparingTo("64.00");
        assertThat(c.inList()).isTrue();
    }

    @Test
    void 처음_등록이면_scoreBefore와_이전_최고가_null이고_newBest이다() {
        when(skillService.mySkill(USER)).thenReturn(skill("0.00"), skill("304.00", scored(1, CHART, "304.00")));
        when(skillService.chartRating(USER, CHART)).thenReturn(new ChartRating(null, RatingGroup.SINGLE, null, null),
                rated(RatingGroup.SINGLE, "95.00", "304.00"));

        RatingChangeResponse c = service.withChange(USER, CHART, () -> savedWith("95.00")).ratingChange();

        assertThat(c.scoreBefore()).isNull();
        assertThat(c.previousBestRate()).isNull();
        assertThat(c.newBest()).isTrue();
        assertThat(c.entered()).isTrue();
    }

    @Test
    void 이전_최고_95에_90을_저장하면_최고가_아니고_레이팅은_그대로다() {
        when(skillService.mySkill(USER)).thenReturn(skill("304.00", scored(1, CHART, "304.00")),
                skill("304.00", scored(1, CHART, "304.00")));
        when(skillService.chartRating(USER, CHART)).thenReturn(rated(RatingGroup.SINGLE, "95.00", "304.00"));

        RatingChangeResponse c = service.withChange(USER, CHART, () -> savedWith("90.00")).ratingChange();

        assertThat(c.newBest()).isFalse();
        assertThat(c.loweredBest()).isFalse();
        assertThat(c.previousBestRate()).isEqualByComparingTo("95.00");
        assertThat(c.change()).isEqualByComparingTo("0.00");
    }

    @Test
    void 같은_달성률이면_최고_기록이_아니다() {
        when(skillService.mySkill(USER)).thenReturn(skill("304.00", scored(1, CHART, "304.00")));
        when(skillService.chartRating(USER, CHART)).thenReturn(rated(RatingGroup.SINGLE, "95.00", "304.00"));

        assertThat(service.withChange(USER, CHART, () -> savedWith("95.00")).ratingChange().newBest()).isFalse();
    }

    @Test
    void 고쳐서_최고_기록이_내려가면_loweredBest이다() {
        when(skillService.mySkill(USER)).thenReturn(skill("304.00", scored(1, CHART, "304.00")),
                skill("240.00", scored(1, CHART, "240.00")));
        when(skillService.chartRating(USER, CHART)).thenReturn(rated(RatingGroup.SINGLE, "95.00", "304.00"),
                rated(RatingGroup.SINGLE, "80.00", "240.00"));

        RatingChangeResponse c = service.withChange(USER, CHART, () -> savedWith("80.00")).ratingChange();

        assertThat(c.newBest()).isFalse();
        assertThat(c.loweredBest()).isTrue();
        assertThat(c.change()).isEqualByComparingTo("-64.00");
    }

    @Test
    void 한도까지_찬_그룹에서_목록_밖이면_마지막_점수와의_차이를_돌려준다() {
        // 한도 2: 마지막(2위) 점수 304.00, 내 점수 240.00 -> 64.00 남음
        SkillResponse list = full("608.00", 2, scored(1, 1L, "304.00"), scored(2, 2L, "304.00"));
        when(skillService.mySkill(USER)).thenReturn(list, list);
        when(skillService.chartRating(USER, CHART)).thenReturn(rated(RatingGroup.SINGLE, "80.00", "240.00"));

        RatingChangeResponse c = service.withChange(USER, CHART, () -> savedWith("80.00")).ratingChange();

        assertThat(c.inList()).isFalse();
        assertThat(c.rank()).isNull();
        assertThat(c.groupLimit()).isEqualTo(2);
        assertThat(c.pointsToList()).isEqualByComparingTo("64.00");
    }

    @Test
    void 그룹이_덜_찼으면_pointsToList는_null이다() {
        SkillResponse list = full("304.00", 15, scored(1, 1L, "304.00"));
        when(skillService.mySkill(USER)).thenReturn(list, list);
        when(skillService.chartRating(USER, CHART)).thenReturn(rated(RatingGroup.SINGLE, "80.00", "240.00"));

        assertThat(service.withChange(USER, CHART, () -> savedWith("80.00")).ratingChange().pointsToList()).isNull();
    }

    @Test
    void 기준_난이도_없는_채보는_TIER_UNDECIDED이고_그룹이_없다() {
        when(skillService.mySkill(USER)).thenReturn(skill("0.00"), skill("0.00"));
        when(skillService.chartRating(USER, CHART)).thenReturn(new ChartRating(NotRatedReason.TIER_UNDECIDED, null, null, null),
                new ChartRating(NotRatedReason.TIER_UNDECIDED, null, new BigDecimal("95.00"), null));

        RatingChangeResponse c = service.withChange(USER, CHART, () -> savedWith("95.00")).ratingChange();

        assertThat(c.notRatedReason()).isEqualTo(NotRatedReason.TIER_UNDECIDED);
        assertThat(c.group()).isNull();
        assertThat(c.groupLimit()).isNull();
        assertThat(c.pointsToList()).isNull();
    }

    @Test
    void 레이팅_제외_속성은_EXCLUDED이다() {
        when(skillService.mySkill(USER)).thenReturn(skill("0.00"), skill("0.00"));
        when(skillService.chartRating(USER, CHART)).thenReturn(new ChartRating(NotRatedReason.EXCLUDED, null, null, null));

        assertThat(service.withChange(USER, CHART, () -> savedWith("95.00")).ratingChange().notRatedReason())
                .isEqualTo(NotRatedReason.EXCLUDED);
    }

    @Test
    void 채보_상태_계산이_실패해도_기본_필드는_그대로_나온다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.00"), skill("101.00"));
        when(skillService.chartRating(USER, CHART)).thenThrow(new IllegalStateException("실패"));

        RatingChangeResponse c = service.withChange(USER, CHART, () -> savedWith("95.00")).ratingChange();

        assertThat(c.change()).isEqualByComparingTo("1.00");
        assertThat(c.scoreAfter()).isNull();
        assertThat(c.newBest()).isNull();
    }
}
