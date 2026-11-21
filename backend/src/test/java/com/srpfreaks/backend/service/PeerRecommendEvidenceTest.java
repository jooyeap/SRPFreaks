package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.mapper.PeerChartCount;
import com.srpfreaks.backend.mapper.PeerStatsMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 추천의 같은 티어대 근거(D89). DB 없이 mapper와 SkillService를 가짜로 두고 기준 인원 규칙만 확인한다. */
@ExtendWith(MockitoExtension.class)
class PeerRecommendEvidenceTest {

    static final long ME = 7L;

    @Mock AppSettingRepository appSettingRepository;
    @Mock SkillService skillService;
    @Mock PeerStatsMapper mapper;

    PeerRecommendEvidence evidence;

    @BeforeEach
    void setUp() {
        evidence = new PeerRecommendEvidence(appSettingRepository, skillService, mapper);
        lenient().when(appSettingRepository.findAll()).thenReturn(List.of(
                setting("rating.pivot", "6.0"), setting("rating.high_slope", "5"), setting("rating.high_offset", "15"),
                setting("rating.low_slope", "10"), setting("rating.low_offset", "45"),
                setting("rating.cap_rate", "80"), setting("rating.max_rate", "95"), setting("rating.bonus", "3.2"),
                setting("rating.score_multiplier", "20"), setting("rating.list_single", "15"),
                setting("rating.list_other", "25"), setting("rating.note_option", "SUPER_RANDOM_PLUS"),
                setting("peer.min_band_users", "5"), setting("peer.min_chart_users", "4")));
    }

    private static AppSetting setting(String key, String value) {
        return AppSetting.create(key, value, null);
    }

    private static SkillEntryResponse entry(long chartId) {
        return new SkillEntryResponse(1, chartId, chartId, "곡" + chartId, InstrumentPart.GUITAR, DifficultyType.MASTER,
                new BigDecimal("9.50"), new BigDecimal("7.0"), "단일", new BigDecimal("90.00"), false,
                AchievementStage.of(new BigDecimal("90.00"), false), new BigDecimal("20"), BigDecimal.ONE, new BigDecimal("300"));
    }

    private void givenMine(PlayerTierResponse tier) {
        when(skillService.mySkill(ME)).thenReturn(new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, new BigDecimal("1000"),
                new BigDecimal("500"), new BigDecimal("500"), tier, 15, 25, List.of(entry(1L)), List.of(entry(2L))));
    }

    @Test
    void 구간_인원이_기준_미만이면_채보_인원을_세지_않고_근거가_없다() {
        givenMine(new PlayerTierResponse("t", "SS 3", 1000, "다음", 1100));
        when(mapper.countBandUsers(eq(ME), eq("SUPER_RANDOM_PLUS"), any(), any())).thenReturn(4);   // peer.min_band_users 5 미만

        assertThat(evidence.of(ME)).isEqualTo(PeerRecommendEvidence.Evidence.NONE);
        verify(mapper, never()).countChartUsers(any(), any(), any(), any(), anyInt());
    }

    @Test
    void 티어가_없으면_근거가_없다() {
        givenMine(null);

        assertThat(evidence.of(ME)).isEqualTo(PeerRecommendEvidence.Evidence.NONE);
        verify(mapper, never()).countBandUsers(any(), any(), any(), any());
    }

    @Test
    void 구간_인원이_충분하면_채보별_인원과_내_레이팅_채보를_돌려준다_기준_인원은_쿼리에_넘긴다() {
        givenMine(new PlayerTierResponse("t", "SS 3", 1000, "다음", 1100));
        when(mapper.countBandUsers(eq(ME), eq("SUPER_RANDOM_PLUS"), any(), any())).thenReturn(5);
        when(mapper.countChartUsers(eq(ME), eq("SUPER_RANDOM_PLUS"), eq(new BigDecimal("1000")), eq(new BigDecimal("1100")), eq(4)))
                .thenReturn(List.of(new PeerChartCount(10L, 6), new PeerChartCount(11L, 4)));

        PeerRecommendEvidence.Evidence e = evidence.of(ME);

        assertThat(e.usersByChart()).containsOnly(org.assertj.core.api.Assertions.entry(10L, 6), org.assertj.core.api.Assertions.entry(11L, 4));
        assertThat(e.myRatedIds()).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void 결과에는_유저를_알_수_있는_정보가_없다() {
        assertThat(PeerChartCount.class.getRecordComponents()).extracting(c -> c.getName()).containsExactly("songDifficultyId", "users");
        assertThat(PeerRecommendEvidence.Evidence.class.getRecordComponents()).extracting(c -> c.getName())
                .containsExactly("usersByChart", "myRatedIds");
    }
}
