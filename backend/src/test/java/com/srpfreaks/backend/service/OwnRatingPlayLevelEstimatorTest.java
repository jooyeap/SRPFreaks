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
import java.util.Optional;

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
                AppSetting.create("setlist.recommend_range_ss", "0.3", null),
                AppSetting.create("setlist.recommend_range_s", "0.5", null),
                AppSetting.create("setlist.recommend_min_entries", "10", null)));
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
        // 단일 6개(6.0) + 그 외 4개(7.0) -> (36 + 28) / 10 = 6.40
        when(skillService.mySkill(1L)).thenReturn(skill(entries(6, "6.0"), entries(4, "7.0")));

        assertThat(estimator.estimate(1L)).hasValueSatisfying(v -> assertThat(v).isEqualByComparingTo("6.40"));
    }

    @Test
    void 평균은_둘째_자리에서_반올림한다() {
        // (6.0 x 10 + 6.1) / 11 = 6.00909... -> 6.01
        List<SkillEntryResponse> single = new ArrayList<>(entries(10, "6.0"));
        single.add(entry(11, "6.1"));
        when(skillService.mySkill(1L)).thenReturn(skill(single, List.of()));

        assertThat(estimator.estimate(1L)).hasValueSatisfying(v -> assertThat(v).isEqualByComparingTo("6.01"));
    }

    @Test
    void 채보가_최소_개수보다_적으면_추정하지_않는다() {
        when(skillService.mySkill(1L)).thenReturn(skill(entries(5, "6.0"), entries(4, "6.0")));

        assertThat(estimator.estimate(1L)).isEqualTo(Optional.empty());
    }

    @Test
    void 정확히_최소_개수이면_추정한다() {
        when(skillService.mySkill(1L)).thenReturn(skill(entries(10, "5.0"), List.of()));

        assertThat(estimator.estimate(1L)).hasValueSatisfying(v -> assertThat(v).isEqualByComparingTo("5.00"));
    }

    @Test
    void 레이팅_목록이_비어_있으면_추정하지_않는다() {
        when(skillService.mySkill(1L)).thenReturn(skill(List.of(), List.of()));

        assertThat(estimator.estimate(1L)).isEmpty();
    }
}
