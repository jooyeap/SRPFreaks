package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.PeerStatsResponse;
import com.srpfreaks.backend.dto.PeerStatsResponse.PeerChartStat;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.dto.WeaknessAnalysisResponse;
import com.srpfreaks.backend.dto.WeaknessAnalysisResponse.BandRow;
import com.srpfreaks.backend.dto.WeaknessAnalysisResponse.PatternRow;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.PeerBandAverage;
import com.srpfreaks.backend.mapper.PeerGroupAverage;
import com.srpfreaks.backend.mapper.PeerStatsMapper;
import com.srpfreaks.backend.mapper.RecommendCandidate;
import com.srpfreaks.backend.mapper.SetlistRecommendMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 약점 분석(D72) 서비스. DB 없이 mapper와 SkillService를 가짜로 두고 계산 규칙만 확인한다.
 *
 * 직접 계산한 값: 묶음은 FLOOR(T / 0.5) x 0.5 이다. 5.4 -> 5.0, 5.5 -> 5.5, 5.9 -> 5.5, 6.0 -> 6.0, 6.4 -> 6.0, 7.0 -> 7.0.
 * 평균은 소수 둘째 자리(HALF_UP), 차이는 표시된 두 평균의 차(내 - 같은 티어)다.
 */
@ExtendWith(MockitoExtension.class)
class WeaknessAnalysisServiceTest {

    static final long ME = 7L;

    @Mock AppSettingRepository appSettingRepository;
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock SkillService skillService;
    @Mock PeerStatsService peerStatsService;
    @Mock PeerStatsMapper peerMapper;
    @Mock SetlistRecommendMapper recommendMapper;

    WeaknessAnalysisService service;

    @BeforeEach
    void setUp() {
        service = new WeaknessAnalysisService(appSettingRepository, difficultyTableRepository, skillService,
                peerStatsService, peerMapper, recommendMapper);
        lenient().when(appSettingRepository.findAll()).thenReturn(List.of(
                setting("rating.pivot", "6.0"), setting("rating.high_slope", "5"), setting("rating.high_offset", "15"),
                setting("rating.low_slope", "10"), setting("rating.low_offset", "45"),
                setting("rating.cap_rate", "80"), setting("rating.max_rate", "95"), setting("rating.bonus", "3.2"),
                setting("rating.score_multiplier", "20"), setting("rating.list_single", "15"),
                setting("rating.list_other", "25"), setting("rating.note_option", "SUPER_RANDOM_PLUS"),
                setting("peer.min_band_users", "5"), setting("peer.min_chart_users", "5")));
        DifficultyTable table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        ReflectionTestUtils.setField(table, "id", 3L);
        lenient().when(difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(
                NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE)).thenReturn(Optional.of(table));
    }

    private static AppSetting setting(String key, String value) {
        return AppSetting.create(key, value, null);
    }

    private static PlayerTierResponse tier() {
        return new PlayerTierResponse("t", "SS 3", 1000, "다음", 1100);
    }

    private static SkillEntryResponse entry(long chartId, String tier, String pattern, String rate) {
        return new SkillEntryResponse(1, chartId, chartId, "곡" + chartId, InstrumentPart.GUITAR, DifficultyType.MASTER,
                new BigDecimal("9.50"), new BigDecimal(tier), pattern, new BigDecimal(rate), false,
                AchievementStage.of(new BigDecimal(rate), false), new BigDecimal("20"), BigDecimal.ONE, new BigDecimal("300"));
    }

    private void givenMine(List<SkillEntryResponse> single, List<SkillEntryResponse> other) {
        when(skillService.mySkill(ME)).thenReturn(new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, new BigDecimal("1050"),
                new BigDecimal("500"), new BigDecimal("550"), tier(), 15, 25, single, other));
    }

    private void givenPeers(int bandUsers, List<PeerGroupAverage> patterns, List<PeerBandAverage> bands) {
        when(peerMapper.countBandUsers(eq(ME), eq("SUPER_RANDOM_PLUS"), any(), any())).thenReturn(bandUsers);
        lenient().when(peerMapper.findPatternAverages(eq(ME), any(), any(), any(), eq(3L), any(), any(), any()))
                .thenReturn(patterns);
        lenient().when(peerMapper.findBandAverages(eq(ME), any(), any(), any(), eq(3L), any(), any())).thenReturn(bands);
    }

    private static PeerGroupAverage pg(String label, long users, String avg) {
        return new PeerGroupAverage(label, users, users * 3, new BigDecimal(avg));
    }

    private static PeerBandAverage pb(String band, long users, String avg) {
        return new PeerBandAverage(new BigDecimal(band), users, users * 3, new BigDecimal(avg));
    }

    // ------------------------------------------------------------ 묶음 계산(순수)

    @Test
    void 난이도대는_0점5_단위로_묶는다() {
        assertThat(WeaknessAnalysisService.bandOf(new BigDecimal("5.4"))).isEqualByComparingTo("5.0");
        assertThat(WeaknessAnalysisService.bandOf(new BigDecimal("5.5"))).isEqualByComparingTo("5.5");
        assertThat(WeaknessAnalysisService.bandOf(new BigDecimal("5.9"))).isEqualByComparingTo("5.5");
        assertThat(WeaknessAnalysisService.bandOf(new BigDecimal("6.0"))).isEqualByComparingTo("6.0");
        assertThat(WeaknessAnalysisService.bandOf(new BigDecimal("6.4"))).isEqualByComparingTo("6.0");
        assertThat(WeaknessAnalysisService.bandOf(new BigDecimal("7.0"))).isEqualByComparingTo("7.0");
    }

    @Test
    void 속성은_항상_네_줄이고_복합_단일은_복합에_합친다() {
        List<PatternRow> rows = WeaknessAnalysisService.patternRows(List.of(
                entry(1, "7.0", "단일", "90.00"),
                entry(2, "7.0", "단일", "80.00"),
                entry(3, "7.0", "복합", "70.00"),
                entry(4, "7.0", "복합(단일)", "60.00")), List.of(), 5);

        assertThat(rows).extracting(PatternRow::pattern).containsExactly("SINGLE", "COMPOUND", "DOUBLE", "TRIPLE");
        // 단일 (90 + 80) / 2 = 85.00, 복합 (70 + 60) / 2 = 65.00, 이중·삼중은 내 목록에 없다
        assertThat(rows.get(0).myAvg()).isEqualByComparingTo("85.00");
        assertThat(rows.get(0).myCharts()).isEqualTo(2);
        assertThat(rows.get(1).myAvg()).isEqualByComparingTo("65.00");
        assertThat(rows.get(1).myCharts()).isEqualTo(2);
        assertThat(rows.get(2).myAvg()).isNull();
        assertThat(rows.get(2).myCharts()).isZero();
        assertThat(rows.get(3).myAvg()).isNull();
    }

    @Test
    void 같은_티어_평균은_묶음_유저_수가_기준_이상일_때만_담고_차이는_표시값_기준이다() {
        List<PatternRow> rows = WeaknessAnalysisService.patternRows(List.of(
                entry(1, "7.0", "단일", "90.00"),
                entry(2, "7.0", "삼중", "80.00")), List.of(
                pg("단일", 5, "92.345"),   // 기준(5명) 딱 충족 -> 92.35(HALF_UP)
                pg("삼중", 4, "70.00")), 5);  // 4명 -> 숨김

        PatternRow single = rows.get(0);
        assertThat(single.peerAvg()).isEqualByComparingTo("92.35");
        assertThat(single.peerUsers()).isEqualTo(5);
        assertThat(single.diff()).isEqualByComparingTo("-2.35");   // 90.00 - 92.35
        PatternRow triple = rows.get(3);
        assertThat(triple.myAvg()).isEqualByComparingTo("80.00");
        assertThat(triple.peerAvg()).isNull();
        assertThat(triple.peerUsers()).isNull();
        assertThat(triple.diff()).isNull();
    }

    @Test
    void 난이도대_줄은_내_목록에_있는_묶음만_기준_난이도_높은_순으로_나온다() {
        List<BandRow> rows = WeaknessAnalysisService.bandRows(List.of(
                entry(1, "5.5", "단일", "80.00"),
                entry(2, "5.9", "복합", "90.00"),
                entry(3, "7.2", "단일", "99.00"),
                entry(4, "6.0", "삼중", "70.00")), List.of(pb("5.5", 6, "86.00"), pb("9.0", 9, "50.00")), 5);

        assertThat(rows).extracting(r -> r.tierFrom().doubleValue()).containsExactly(7.0, 6.0, 5.5);
        BandRow low = rows.get(2);
        assertThat(low.tierTo()).isEqualByComparingTo("5.9");
        assertThat(low.myCharts()).isEqualTo(2);
        assertThat(low.myAvg()).isEqualByComparingTo("85.00");       // (80 + 90) / 2
        assertThat(low.peerAvg()).isEqualByComparingTo("86.00");
        assertThat(low.diff()).isEqualByComparingTo("-1.00");
        assertThat(rows.get(0).peerAvg()).isNull();                  // 같은 티어 값이 없는 묶음
    }

    // ------------------------------------------------------------ 약점 고르기

    private static BandRow band(String from, int charts, String diff) {
        BigDecimal f = new BigDecimal(from);
        return new BandRow(f, f.add(new BigDecimal("0.4")), charts, new BigDecimal("80.00"),
                diff == null ? null : new BigDecimal("80.00").subtract(new BigDecimal(diff)),
                diff == null ? null : 6, diff == null ? null : new BigDecimal(diff).negate(), false);
    }

    @Test
    void 약점은_내_채보_수가_기준_이상이고_차이가_음수인_묶음_중_가장_낮은_것() {
        List<BandRow> bands = List.of(
                band("7.0", 5, "1.00"),    // 차이 -1.00
                band("6.5", 4, "-3.00"),   // 차이 +3.00 (앞섬)
                band("6.0", 2, "9.00"),    // 차이 -9.00이지만 내 채보 2곡 -> 후보 아님
                band("5.5", 3, "4.00"),    // 차이 -4.00, 3곡(기준 충족)
                band("5.0", 6, null));     // 비교값 없음
        assertThat(WeaknessAnalysisService.weakBand(bands)).isEqualByComparingTo("5.5");
    }

    @Test
    void 차이가_같으면_기준_난이도가_높은_묶음이_약점이고_모두_앞서면_약점이_없다() {
        assertThat(WeaknessAnalysisService.weakBand(List.of(band("6.0", 3, "2.00"), band("7.0", 3, "2.00"))))
                .isEqualByComparingTo("7.0");
        assertThat(WeaknessAnalysisService.weakBand(List.of(band("6.0", 3, "-2.00"), band("7.0", 3, "0.00")))).isNull();
    }

    // ------------------------------------------------------------ 전체 흐름

    @Test
    void 구간_인원이_기준_미만이면_같은_티어_값은_모두_비우고_집계_쿼리를_부르지_않는다() {
        givenMine(List.of(entry(1, "7.0", "단일", "90.00")), List.of());
        when(peerMapper.countBandUsers(eq(ME), eq("SUPER_RANDOM_PLUS"), any(), any())).thenReturn(4);

        WeaknessAnalysisResponse response = service.analyze(ME);

        assertThat(response.peerAvailable()).isFalse();
        assertThat(response.bandUsers()).isEqualTo(4);
        assertThat(response.patterns()).allSatisfy(p -> {
            assertThat(p.peerAvg()).isNull();
            assertThat(p.diff()).isNull();
        });
        assertThat(response.bands()).allSatisfy(b -> assertThat(b.peerAvg()).isNull());
        assertThat(response.weakBandFrom()).isNull();
        assertThat(response.easyCharts()).isEmpty();
        assertThat(response.patterns().get(0).myAvg()).isEqualByComparingTo("90.00");   // 내 값은 그대로
        verify(peerMapper, never()).findPatternAverages(any(), any(), any(), any(), any(), any(), any(), any());
        verify(peerMapper, never()).findBandAverages(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void 약점_난이도대를_표시하고_올리기_쉬운_곡_셋을_예상_점수_증가_순으로_고른다() {
        // 내 목록: 6.0 묶음 3곡 평균 70.00(약점 후보), 7.0 묶음 3곡 평균 95.00
        List<SkillEntryResponse> mine = new ArrayList<>(List.of(
                entry(1, "6.0", "단일", "70.00"), entry(2, "6.2", "단일", "70.00"), entry(3, "6.4", "단일", "70.00"),
                entry(4, "7.0", "단일", "95.00"), entry(5, "7.2", "단일", "95.00"), entry(6, "7.4", "단일", "95.00")));
        givenMine(mine, List.of());
        givenPeers(6, List.of(pg("단일", 6, "90.00")), List.of(pb("6.0", 6, "85.00"), pb("7.0", 6, "94.00")));

        // 약점 묶음(6.0) 후보 채보 다섯 개: 내 기록 없음(10), 내 90(11), 내 60(12), 내 70(13), 이미 중앙값 이상(14)
        when(recommendMapper.findCandidates(eq(ME), eq("SUPER_RANDOM_PLUS"), eq(3L), any(),
                eq(new BigDecimal("6.0")), eq(new BigDecimal("6.4")))).thenReturn(List.of(
                cand(10, null), cand(11, "90.00"), cand(12, "60.00"), cand(13, "70.00"), cand(14, "99.00")));
        when(peerStatsService.statsForServerChosenCharts(eq(ME), anyList())).thenReturn(new PeerStatsResponse("SS 3", 6, List.of(
                stat(10, "88.00", "30.00"),
                stat(11, "92.00", "5.00"),
                stat(12, "88.00", "50.00"),
                stat(13, "88.00", "40.00"),
                stat(14, "90.00", "10.00"))));   // 내 99 >= 중앙값 90 -> 제외

        WeaknessAnalysisResponse response = service.analyze(ME);

        assertThat(response.weakBandFrom()).isEqualByComparingTo("6.0");
        assertThat(response.bands()).extracting(BandRow::weak).containsExactly(false, true);   // 7.0, 6.0 순서
        BandRow weak = response.bands().get(1);
        assertThat(weak.diff()).isEqualByComparingTo("-15.00");   // 70.00 - 85.00
        // 예상 증가 큰 순: 12(50), 13(40), 10(30). 11(내 90 < 중앙값 92, 증가 5)는 4번째라 잘린다
        assertThat(response.easyCharts()).extracting(c -> c.songDifficultyId())
                .containsExactly(12L, 13L, 10L);
        assertThat(response.easyCharts().get(0).currentRate()).isEqualByComparingTo("60.00");
        assertThat(response.easyCharts().get(0).targetRate()).isEqualByComparingTo("88.00");
        assertThat(response.easyCharts().get(0).expectedGain()).isEqualByComparingTo("50.00");
        assertThat(response.easyCharts().get(2).currentRate()).isNull();   // 기록 없는 채보
    }

    @Test
    void 약점이_없으면_올리기_쉬운_곡은_조회하지_않는다() {
        givenMine(List.of(entry(1, "6.0", "단일", "95.00"), entry(2, "6.1", "단일", "95.00"), entry(3, "6.2", "단일", "95.00")), List.of());
        givenPeers(6, List.of(), List.of(pb("6.0", 6, "85.00")));

        WeaknessAnalysisResponse response = service.analyze(ME);

        assertThat(response.weakBandFrom()).isNull();
        assertThat(response.easyCharts()).isEmpty();
        verify(recommendMapper, never()).findCandidates(any(), any(), any(), any(), any(), any());
        verify(peerStatsService, never()).statsForServerChosenCharts(any(), anyList());
    }

    @Test
    void 응답_어디에도_유저_식별_정보_필드가_없다() {
        List<Class<?>> types = List.of(WeaknessAnalysisResponse.class, PatternRow.class, BandRow.class,
                WeaknessAnalysisResponse.EasyChart.class);
        for (Class<?> type : types) {
            for (RecordComponent c : type.getRecordComponents()) {
                String name = c.getName().toLowerCase();
                assertThat(name).doesNotContain("userid").doesNotContain("nickname").doesNotContain("email")
                        .doesNotContain("googlesub").doesNotContain("peerrates");
            }
        }
    }

    private static RecommendCandidate cand(long id, String best) {
        return new RecommendCandidate(id, id, "곡" + id, "GUITAR", "MASTER", new BigDecimal("9.50"), new BigDecimal("6.2"),
                "단일", best == null ? null : new BigDecimal(best), best == null ? null : Boolean.FALSE);
    }

    private static PeerChartStat stat(long id, String median, String gain) {
        return new PeerChartStat(id, 6, new BigDecimal(median), new BigDecimal(gain), false, null);
    }
}
