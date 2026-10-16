package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RatingChangeResponse;
import com.srpfreaks.backend.dto.RecordResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.entity.NoteOption;
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

        RecordResponse result = service.withChange(USER, RecordRatingChangeServiceTest::saved);

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

        RatingChangeResponse change = service.withChange(USER, RecordRatingChangeServiceTest::saved).ratingChange();

        assertThat(change.entered()).isFalse();
        assertThat(change.inList()).isTrue();
        assertThat(change.change()).isEqualByComparingTo("1.00");
    }

    @Test
    void 목록_밖의_곡이면_inList가_false이고_레이팅은_그대로다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.00", entry(1)), skill("100.00", entry(1)));

        RatingChangeResponse change = service.withChange(USER, RecordRatingChangeServiceTest::saved).ratingChange();

        assertThat(change.inList()).isFalse();
        assertThat(change.entered()).isFalse();
        assertThat(change.change()).isEqualByComparingTo("0.00");
    }

    @Test
    void 기록을_낮게_고치면_음수_변화가_나온다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.00", entry(CHART)), skill("98.50", entry(CHART)));

        assertThat(service.withChange(USER, RecordRatingChangeServiceTest::saved).ratingChange().change())
                .isEqualByComparingTo("-1.50");
    }

    @Test
    void 레이팅_계산이_실패해도_저장_응답은_그대로_돌려주고_변화만_비운다() {
        when(skillService.mySkill(USER)).thenThrow(new IllegalStateException("계산 실패"));

        RecordResponse result = service.withChange(USER, RecordRatingChangeServiceTest::saved);

        assertThat(result.id()).isEqualTo(1L);
        assertThat(result.ratingChange()).isNull();
    }
}
