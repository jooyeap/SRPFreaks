package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PeerStatsResponse;
import com.srpfreaks.backend.dto.PeerStatsResponse.PeerChartStat;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.PeerChartMeta;
import com.srpfreaks.backend.mapper.PeerChartRate;
import com.srpfreaks.backend.mapper.PeerStatsMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 같은 티어 유저 기록(D53) 서비스. DB 없이 mapper와 SkillService를 가짜로 두고 계산 규칙만 확인한다.
 *
 * 직접 계산한 값(레이팅 기준 난이도 7.0 -> R = 5x7-15 = 20):
 *   중앙값 90% -> V = 20x80/100 + 3.2x10/15 = 16 + 2.1333.. = 18.1333.. -> 점수 = V x 20 = 362.666.. -> 표시 362.67
 */
@ExtendWith(MockitoExtension.class)
class PeerStatsServiceTest {

    static final long ME = 7L;
    static final long CHART = 100L;

    @Mock AppSettingRepository appSettingRepository;
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock SkillService skillService;
    @Mock PeerStatsMapper mapper;

    PeerStatsService service;

    @BeforeEach
    void setUp() {
        service = new PeerStatsService(appSettingRepository, difficultyTableRepository, skillService, mapper);
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

    private static PlayerTierResponse tier(int min, Integer next) {
        return new PlayerTierResponse("t", "SS 3", min, next == null ? null : "다음", next);
    }

    private static SkillEntryResponse entry(long chartId, String pattern, String rate, String score) {
        return new SkillEntryResponse(1, chartId, chartId, "곡" + chartId, InstrumentPart.GUITAR, DifficultyType.MASTER,
                new BigDecimal("9.50"), new BigDecimal("7.0"), pattern, new BigDecimal(rate), false,
                AchievementStage.of(new BigDecimal(rate), false), new BigDecimal("20"), BigDecimal.ONE, new BigDecimal(score));
    }

    private SkillResponse skill(PlayerTierResponse tier, List<SkillEntryResponse> single, List<SkillEntryResponse> other) {
        return new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, new BigDecimal("1000"), new BigDecimal("500"),
                new BigDecimal("500"), tier, 15, 25, single, other);
    }

    /** 같은 달성률을 가진 유저 n명 분의 줄 */
    private static List<PeerChartRate> rates(long chartId, String... rates) {
        List<PeerChartRate> rows = new ArrayList<>();
        for (String r : rates) {
            rows.add(new PeerChartRate(chartId, new BigDecimal(r)));
        }
        return rows;
    }

    private void givenPeers(int bandUsers, List<PeerChartRate> rows, String pattern) {
        when(mapper.countBandUsers(eq(ME), eq("SUPER_RANDOM_PLUS"), any(), any())).thenReturn(bandUsers);
        when(mapper.findChartRates(eq(ME), eq("SUPER_RANDOM_PLUS"), any(), any(), anyCollection())).thenReturn(rows);
        lenient().when(mapper.findChartMeta(eq(3L), any(), anyCollection()))
                .thenReturn(pattern == null ? List.of() : List.of(new PeerChartMeta(CHART, new BigDecimal("7.0"), pattern)));
    }

    // -------------------------------------------------------------- 중앙값

    @Test
    void 중앙값은_홀수_개면_가운데_값() {
        assertThat(PeerStatsService.median(List.of(new BigDecimal("95.00"), new BigDecimal("80.00"), new BigDecimal("88.00"))))
                .isEqualByComparingTo("88.00");
    }

    @Test
    void 중앙값은_짝수_개면_가운데_두_값의_평균이고_둘째_자리로_반올림한다() {
        // (88.00 + 90.01) / 2 = 89.005 -> HALF_UP 89.01
        assertThat(PeerStatsService.median(List.of(new BigDecimal("90.01"), new BigDecimal("80.00"),
                new BigDecimal("88.00"), new BigDecimal("99.00")))).isEqualByComparingTo("89.01");
    }

    @Test
    void 극단값_하나가_있어도_중앙값은_거의_안_흔들린다() {
        assertThat(PeerStatsService.median(List.of(new BigDecimal("85.00"), new BigDecimal("86.00"),
                new BigDecimal("87.00"), new BigDecimal("88.00"), new BigDecimal("100.00")))).isEqualByComparingTo("87.00");
    }

    // -------------------------------------------------------------- 표시 기준

    @Test
    void 구간_인원이_기준에_못_미치면_채보_집계를_조회하지_않고_빈_결과() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(), List.of()));
        when(mapper.countBandUsers(eq(ME), any(), any(), any())).thenReturn(4);

        PeerStatsResponse response = service.stats(ME, List.of(CHART));

        assertThat(response.bandUsers()).isEqualTo(4);
        assertThat(response.charts()).isEmpty();
        verify(mapper, never()).findChartRates(any(), any(), any(), any(), anyCollection());
    }

    @Test
    void 구간_인원이_정확히_기준이면_보여_준다() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(), List.of()));
        givenPeers(5, rates(CHART, "90", "90", "90", "90", "90"), "단일");

        assertThat(service.stats(ME, List.of(CHART)).charts()).hasSize(1);
    }

    @Test
    void 채보를_넣은_유저가_기준에_못_미치면_그_채보는_빠진다() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(), List.of()));
        List<PeerChartRate> rows = new ArrayList<>(rates(CHART, "90", "90", "90", "90"));   // 4명
        rows.addAll(rates(101L, "80", "81", "82", "83", "84"));                              // 5명
        when(mapper.countBandUsers(eq(ME), any(), any(), any())).thenReturn(8);
        when(mapper.findChartRates(eq(ME), any(), any(), any(), anyCollection())).thenReturn(rows);
        when(mapper.findChartMeta(eq(3L), any(), anyCollection())).thenReturn(List.of());

        PeerStatsResponse response = service.stats(ME, List.of(CHART, 101L));

        assertThat(response.bandUsers()).isEqualTo(8);
        assertThat(response.charts()).extracting(PeerChartStat::songDifficultyId).containsExactly(101L);
        assertThat(response.charts().get(0).users()).isEqualTo(5);
        assertThat(response.charts().get(0).medianRate()).isEqualByComparingTo("82.00");
    }

    @Test
    void 기준_인원은_설정에서_온다() {
        when(appSettingRepository.findAll()).thenReturn(List.of(
                setting("rating.pivot", "6.0"), setting("rating.high_slope", "5"), setting("rating.high_offset", "15"),
                setting("rating.low_slope", "10"), setting("rating.low_offset", "45"),
                setting("rating.cap_rate", "80"), setting("rating.max_rate", "95"), setting("rating.bonus", "3.2"),
                setting("rating.score_multiplier", "20"), setting("rating.list_single", "15"),
                setting("rating.list_other", "25"), setting("rating.note_option", "SUPER_RANDOM_PLUS"),
                setting("peer.min_band_users", "20"), setting("peer.min_chart_users", "5")));
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(), List.of()));
        when(mapper.countBandUsers(eq(ME), any(), any(), any())).thenReturn(19);

        assertThat(service.stats(ME, List.of(CHART)).charts()).isEmpty();
    }

    @Test
    void 티어를_알_수_없으면_빈_결과() {
        when(skillService.mySkill(ME)).thenReturn(skill(null, List.of(), List.of()));

        PeerStatsResponse response = service.stats(ME, List.of(CHART));

        assertThat(response.tierName()).isNull();
        assertThat(response.charts()).isEmpty();
        verify(mapper, never()).countBandUsers(any(), any(), any(), any());
    }

    @Test
    void 티어_구간은_내_티어_최소점수부터_다음_티어_최소점수_전까지() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(), List.of()));
        when(mapper.countBandUsers(eq(ME), any(), any(), any())).thenReturn(0);

        service.stats(ME, List.of(CHART));

        ArgumentCaptor<BigDecimal> lo = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<BigDecimal> hi = ArgumentCaptor.forClass(BigDecimal.class);
        verify(mapper).countBandUsers(eq(ME), eq("SUPER_RANDOM_PLUS"), lo.capture(), hi.capture());
        assertThat(lo.getValue()).isEqualByComparingTo("1000");
        assertThat(hi.getValue()).isEqualByComparingTo("1100");
    }

    @Test
    void 가장_높은_티어는_위쪽_한계_없이_아주_큰_값으로_조회한다() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(11000, null), List.of(), List.of()));
        when(mapper.countBandUsers(eq(ME), any(), any(), any())).thenReturn(0);

        service.stats(ME, List.of(CHART));

        ArgumentCaptor<BigDecimal> hi = ArgumentCaptor.forClass(BigDecimal.class);
        verify(mapper).countBandUsers(eq(ME), any(), any(), hi.capture());
        assertThat(hi.getValue()).isGreaterThan(new BigDecimal("99999"));
    }

    // -------------------------------------------------------------- 상승 예상 점수

    @Test
    void 이미_내_목록에_있으면_내_현재_점수와의_차이를_상승_예상으로_한다() {
        SkillEntryResponse mine = entry(CHART, "단일", "85.00", "340.00");
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(mine), List.of()));
        givenPeers(8, rates(CHART, "90", "90", "90", "90", "90"), "단일");

        PeerChartStat stat = service.stats(ME, List.of(CHART)).charts().get(0);

        assertThat(stat.inMyList()).isTrue();
        assertThat(stat.myRate()).isEqualByComparingTo("85.00");
        assertThat(stat.expectedGain()).isEqualByComparingTo("22.67");   // 362.67 - 340.00
    }

    @Test
    void 이미_내_점수가_더_높으면_상승_예상은_0() {
        SkillEntryResponse mine = entry(CHART, "단일", "95.00", "384.00");
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(mine), List.of()));
        givenPeers(8, rates(CHART, "90", "90", "90", "90", "90"), "단일");

        assertThat(service.stats(ME, List.of(CHART)).charts().get(0).expectedGain()).isEqualByComparingTo("0");
    }

    @Test
    void 목록에_없고_단일_그룹이_가득_차면_단일_그룹의_최저_점수를_뺀다() {
        List<SkillEntryResponse> single = new ArrayList<>(IntStream.rangeClosed(1, 15)
                .mapToObj(i -> entry(i, "단일", "90.00", i == 15 ? "300.00" : "400.00")).toList());
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), single, List.of()));
        givenPeers(8, rates(CHART, "90", "90", "90", "90", "90"), "단일");

        PeerChartStat stat = service.stats(ME, List.of(CHART)).charts().get(0);

        assertThat(stat.inMyList()).isFalse();
        assertThat(stat.myRate()).isNull();
        assertThat(stat.expectedGain()).isEqualByComparingTo("62.67");   // 362.67 - 300.00
    }

    @Test
    void 그_외_채보는_그_외_그룹의_최저_점수를_기준으로_한다() {
        // 단일은 가득 차 있어도 그 외 그룹(비어 있음)과 상관없다 -> 그 외 그룹이 덜 찼으니 점수 전체
        List<SkillEntryResponse> single = IntStream.rangeClosed(1, 15)
                .mapToObj(i -> entry(i, "단일", "90.00", "400.00")).toList();
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), single, List.of()));
        givenPeers(8, rates(CHART, "90", "90", "90", "90", "90"), "복합");

        assertThat(service.stats(ME, List.of(CHART)).charts().get(0).expectedGain()).isEqualByComparingTo("362.67");
    }

    @Test
    void 그룹이_덜_차_있으면_점수_전체가_상승분() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(entry(1L, "단일", "90.00", "400.00")), List.of()));
        givenPeers(8, rates(CHART, "90", "90", "90", "90", "90"), "단일");

        assertThat(service.stats(ME, List.of(CHART)).charts().get(0).expectedGain()).isEqualByComparingTo("362.67");
    }

    @Test
    void 레이팅_대상이_아닌_채보는_상승_예상을_비운다() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(), List.of()));
        givenPeers(8, rates(CHART, "90", "90", "90", "90", "90"), null);   // 서열표 값을 못 찾음

        PeerChartStat stat = service.stats(ME, List.of(CHART)).charts().get(0);

        assertThat(stat.expectedGain()).isNull();
        assertThat(stat.users()).isEqualTo(5);
    }

    @Test
    void 속성이_레이팅_제외면_상승_예상을_비운다() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(), List.of()));
        givenPeers(8, rates(CHART, "90", "90", "90", "90", "90"), PatternType.EXCLUDED.getLabel());

        assertThat(service.stats(ME, List.of(CHART)).charts().get(0).expectedGain()).isNull();
    }

    // -------------------------------------------------------------- 입력 검사

    @Test
    void 채보_id가_없거나_너무_많거나_양수가_아니면_400() {
        assertRejected(List.of());
        assertRejected(Collections.nCopies(0, 1L));
        assertRejected(IntStream.rangeClosed(1, PeerStatsService.MAX_CHART_IDS + 1).mapToObj(Long::valueOf).toList());
        assertRejected(List.of(0L));
        assertRejected(List.of(-5L));
    }

    @Test
    void 같은_id가_여러_번_오면_하나로_본다() {
        when(skillService.mySkill(ME)).thenReturn(skill(tier(1000, 1100), List.of(), List.of()));
        when(mapper.countBandUsers(eq(ME), any(), any(), any())).thenReturn(0);

        service.stats(ME, java.util.Arrays.asList(CHART, CHART, CHART));

        verify(mapper).countBandUsers(eq(ME), any(), any(), any());
    }

    private void assertRejected(List<Long> ids) {
        assertThatThrownBy(() -> service.stats(ME, ids))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
    }
}
