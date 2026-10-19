package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.repository.AppSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OwnRatingPlayLevelEstimatorTest {

    @Mock SkillService skillService;
    @Mock AppSettingRepository appSettingRepository;

    OwnRatingPlayLevelEstimator estimator;

    @BeforeEach
    void setUp() {
        estimator = new OwnRatingPlayLevelEstimator(skillService, appSettingRepository);
        when(appSettingRepository.findAll()).thenReturn(List.of(
                AppSetting.create("setlist.recommend_ss_min", "-0.6", null),
                AppSetting.create("setlist.recommend_ss_max", "-0.1", null),
                AppSetting.create("setlist.recommend_s_min", "-0.1", null),
                AppSetting.create("setlist.recommend_s_max", "0.4", null),
                AppSetting.create("setlist.recommend_min_single", "5", null),
                AppSetting.create("setlist.recommend_min_other", "9", null),
                AppSetting.create("setlist.recommend_starter_tier", "5.2", null)));
    }

    private static SkillEntryResponse entry(int rank, String tier) {
        return new SkillEntryResponse(rank, (long) rank, 100L + rank, "곡" + rank, InstrumentPart.GUITAR, DifficultyType.MASTER,
                new BigDecimal("9.50"), tier == null ? null : new BigDecimal(tier), "단일", new BigDecimal("90.00"), false,
                AchievementStage.S, new BigDecimal("15.00"), new BigDecimal("14.00"), new BigDecimal("280.00"));
    }

    private static SkillResponse skill(List<SkillEntryResponse> single, List<SkillEntryResponse> other) {
        return new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, 15, 25, single, other);
    }

    private static List<SkillEntryResponse> entries(int count, String tier) {
        List<SkillEntryResponse> list = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            list.add(entry(i, tier));
        }
        return list;
    }

    @Test
    void 단일과_그_외_목록의_기준_난이도_평균을_둘째_자리까지_구한다() {
        // 단일 5개(6.0) + 그 외 10개(7.0) -> (30 + 70) / 15 = 6.666... -> 6.67
        when(skillService.mySkill(1L)).thenReturn(skill(entries(5, "6.0"), entries(10, "7.0")));

        PlayLevelEstimate result = estimator.estimate(1L);

        assertThat(result.status()).isEqualTo(PlayLevelEstimate.Status.READY);
        assertThat(result.tier()).isEqualByComparingTo("6.67");
        assertThat(result.ratedSingle()).isEqualTo(5);
        assertThat(result.ratedOther()).isEqualTo(10);
    }

    @Test
    void 평균은_둘째_자리에서_반올림한다() {
        // 단일 (6.0 x 10 + 6.1) + 그 외 6.0 x 9 = 120.1 / 20 = 6.005 -> 6.01
        List<SkillEntryResponse> single = new ArrayList<>(entries(10, "6.0"));
        single.add(entry(11, "6.1"));
        when(skillService.mySkill(1L)).thenReturn(skill(single, entries(9, "6.0")));

        assertThat(estimator.estimate(1L).tier()).isEqualByComparingTo("6.01");
    }

    @Test
    void 정확히_그룹별_최소_개수이면_추정한다() {
        when(skillService.mySkill(1L)).thenReturn(skill(entries(5, "5.0"), entries(9, "5.0")));

        PlayLevelEstimate result = estimator.estimate(1L);

        assertThat(result.status()).isEqualTo(PlayLevelEstimate.Status.READY);
        assertThat(result.tier()).isEqualByComparingTo("5.00");
    }

    @Test
    void 단일이_최소_개수보다_적으면_데이터_부족이다() {
        when(skillService.mySkill(1L)).thenReturn(skill(entries(4, "6.0"), entries(9, "6.0")));

        PlayLevelEstimate result = estimator.estimate(1L);

        assertThat(result.status()).isEqualTo(PlayLevelEstimate.Status.INSUFFICIENT);
        assertThat(result.tier()).isNull();
        assertThat(result.ratedSingle()).isEqualTo(4);
        assertThat(result.ratedOther()).isEqualTo(9);
    }

    @Test
    void 그_외가_최소_개수보다_적으면_데이터_부족이다() {
        when(skillService.mySkill(1L)).thenReturn(skill(entries(15, "6.0"), entries(8, "6.0")));

        assertThat(estimator.estimate(1L).status()).isEqualTo(PlayLevelEstimate.Status.INSUFFICIENT);
    }

    @Test
    void 한쪽_그룹만_있어도_다른_쪽이_비면_데이터_부족이다() {
        when(skillService.mySkill(1L)).thenReturn(skill(entries(10, "6.0"), List.of()));

        PlayLevelEstimate result = estimator.estimate(1L);

        assertThat(result.status()).isEqualTo(PlayLevelEstimate.Status.INSUFFICIENT);
        assertThat(result.ratedOther()).isZero();
    }

    @Test
    void 기준_난이도가_없는_채보는_개수에_세지_않는다() {
        List<SkillEntryResponse> single = new ArrayList<>(entries(4, "6.0"));
        single.add(entry(5, null));
        when(skillService.mySkill(1L)).thenReturn(skill(single, entries(9, "6.0")));

        assertThat(estimator.estimate(1L).status()).isEqualTo(PlayLevelEstimate.Status.INSUFFICIENT);
    }

    @Test
    void 레이팅_목록이_비어_있으면_신규_사용자다() {
        when(skillService.mySkill(1L)).thenReturn(skill(List.of(), List.of()));

        PlayLevelEstimate result = estimator.estimate(1L);

        assertThat(result.status()).isEqualTo(PlayLevelEstimate.Status.NEW_PLAYER);
        assertThat(result.tier()).isNull();
    }
}
