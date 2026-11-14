package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.ChartStatsResponse.DeviationRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.FolderRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.Page;
import com.srpfreaks.backend.dto.ChartStatsResponse.PlayerRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.PopularityRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.Summary;
import com.srpfreaks.backend.dto.ChartStatsResponse.UndecidedRow;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.ChartAggregateRow;
import com.srpfreaks.backend.mapper.ChartInfoRow;
import com.srpfreaks.backend.mapper.ChartPlayerRow;
import com.srpfreaks.backend.mapper.ChartStatsMapper;
import com.srpfreaks.backend.mapper.FolderChartCountRow;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 서열표 분석(D77) 서비스. DB 없이 mapper를 가짜로 두고 권한·정렬 화이트리스트·페이지·계산 연결·쿼리 횟수를 확인한다.
 * 집계 쿼리 자체(비공개 유저 제외, 유저별 최고 1개, 최근 7일 경계)는 ChartStatsMapperTest(Testcontainers)가 실제 MySQL에서 확인한다.
 */
@ExtendWith(MockitoExtension.class)
class ChartStatsServiceTest {

    static final long ADMIN = 1L;
    static final long TABLE_ID = 5L;
    static final String SRN_PLUS = NoteOption.SUPER_RANDOM_PLUS.name();

    @Mock UserRepository userRepository;
    @Mock ChartStatsMapper statsMapper;
    @Mock SkillService skillService;
    @Mock DifficultyTableRepository tableRepository;

    ChartStatsService service;

    @BeforeEach
    void setUp() {
        // 2026-11-14 12:00 KST
        Clock clock = Clock.fixed(Instant.parse("2026-11-14T03:00:00Z"), ZoneOffset.UTC);
        service = new ChartStatsService(userRepository, statsMapper, skillService, tableRepository, clock);
        user(ADMIN, Role.ADMIN, true);
        lenient().when(skillService.ratingConfig()).thenReturn(config());
        DifficultyTable table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        ReflectionTestUtils.setField(table, "id", TABLE_ID);
        lenient().when(tableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE))
                .thenReturn(Optional.of(table));
        lenient().when(statsMapper.countPublicUsers()).thenReturn(12);
    }

    // ---- 준비용 도우미

    private static RatingConfig config() {
        Map<String, String> m = new LinkedHashMap<>();
        String[][] values = {{"pivot", "6.0"}, {"high_slope", "5"}, {"high_offset", "15"}, {"low_slope", "10"}, {"low_offset", "45"},
                {"cap_rate", "80"}, {"max_rate", "95"}, {"bonus", "3.2"}, {"score_multiplier", "20"}, {"list_single", "15"},
                {"list_other", "25"}, {"note_option", "SUPER_RANDOM_PLUS"}};
        for (String[] v : values) {
            m.put("rating." + v[0], v[1]);
        }
        return RatingConfig.from(m);
    }

    private User user(long id, Role role, boolean active) {
        User u = User.create("sub" + id, "u" + id + "@example.com", "nick" + id, role);
        ReflectionTestUtils.setField(u, "id", id);
        if (!active) {
            u.block();
        }
        lenient().when(userRepository.findById(id)).thenReturn(Optional.of(u));
        return u;
    }

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    /** 채보 집계 한 줄. avgSum = 유저별 최고 달성률의 합. */
    private static ChartAggregateRow agg(long id, String tier, int players, long records, String sum, long recent) {
        return new ChartAggregateRow(id, 100 + id, "곡" + id, "GUITAR", "MASTER", d("9.50"), tier == null ? null : d(tier),
                players, records, d(sum), recent);
    }

    private void aggregates(ChartAggregateRow... rows) {
        when(statsMapper.findChartAggregates(eq(SRN_PLUS), eq(TABLE_ID), any(LocalDateTime.class))).thenReturn(List.of(rows));
    }

    /** 폴더 6.0: 채보 1~4는 플레이어 3명씩(평균 95·80·90·70), 5는 2명(표본 부족), 6은 미정. */
    private void sampleFolder() {
        aggregates(
                agg(1, "6.0", 3, 5, "285", 2),    // 평균 95
                agg(2, "6.0", 3, 9, "240", 0),    // 평균 80
                agg(3, "6.0", 3, 7, "270", 4),    // 평균 90
                agg(4, "6.0", 3, 6, "210", 1),    // 평균 70
                agg(5, "6.0", 2, 20, "170", 0),   // 플레이어 2명 -> 평균 null
                agg(6, null, 4, 11, "300", 3));   // 미정
    }

    // ---- 권한 (서비스에서 한 번 더 확인)

    @Test
    void USER는_모든_조회에서_403이고_데이터를_읽지_않는다() {
        user(2L, Role.USER, true);

        assertThatThrownBy(() -> service.deviation(2L, null, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> service.popularity(2L, null, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> service.folders(2L, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> service.undecided(2L, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> service.summary(2L, 1L)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> service.players(2L, 1L, null, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        verifyNoInteractions(statsMapper, skillService);
    }

    @Test
    void 차단된_관리자와_없는_유저도_거절한다() {
        user(3L, Role.ADMIN, false);   // 역할이 ADMIN이어도 차단됐으면 토큰이 남아 있어도 읽을 수 없다

        assertThatThrownBy(() -> service.deviation(3L, null, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> service.deviation(99L, null, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> service.deviation(null, null, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        verifyNoInteractions(statsMapper);
    }

    @Test
    void ROOT도_읽을_수_있다() {
        user(4L, Role.ROOT, true);
        aggregates();

        assertThat(service.deviation(4L, null, 0, 20).content()).isEmpty();
    }

    // ---- 정렬 화이트리스트

    @Test
    void 허용_밖의_정렬_값은_400이다() {
        assertThatThrownBy(() -> service.deviation(ADMIN, "deviation; DROP TABLE users", 0, 20))
                .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.VALIDATION_ERROR);
        assertThatThrownBy(() -> service.deviation(ADMIN, "records", 0, 20))
                .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.VALIDATION_ERROR);
        assertThatThrownBy(() -> service.popularity(ADMIN, "30d", 0, 20))
                .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.VALIDATION_ERROR);
        assertThatThrownBy(() -> service.players(ADMIN, 1L, "nickname", 0, 20))
                .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.VALIDATION_ERROR);
        verifyNoInteractions(statsMapper);   // 잘못된 값이면 DB를 읽기 전에 거절한다
    }

    // ---- 편차 목록

    @Test
    void 편차는_자기_곡을_뺀_폴더_평균과의_차이이고_편차_큰_순으로_나온다() {
        sampleFolder();

        Page<DeviationRow> page = service.deviation(ADMIN, "deviation", 0, 20);

        // 직접 계산(폴더 6.0, 표본 충분 곡: 1=95, 2=80, 3=90, 4=70)
        //  채보 4: 다른 곡 평균 (95+80+90)/3 = 88.333333 -> 편차 70 - 88.333333 = -18.33
        //  채보 1: (80+90+70)/3 = 80 -> +15.00
        //  채보 3: (95+80+70)/3 = 81.666667 -> 90 - 81.666667 = +8.33
        //  채보 2: (95+90+70)/3 = 85 -> 80 - 85 = -5.00
        //  채보 5: 플레이어 2명이라 평균·편차 null -> 맨 아래. 채보 6(미정)은 편차 목록에 없다.
        assertThat(page.content()).extracting(r -> r.chart().songDifficultyId()).containsExactly(4L, 1L, 3L, 2L, 5L);
        assertThat(page.content().get(0).deviation()).isEqualByComparingTo("-18.33");
        assertThat(page.content().get(0).folderAvgRate()).isEqualByComparingTo("88.33");
        assertThat(page.content().get(1).avgRate()).isEqualByComparingTo("95.00");
        assertThat(page.content().get(1).deviation()).isEqualByComparingTo("15.00");
        assertThat(page.content().get(1).folderSampleCharts()).isEqualTo(3);
        assertThat(page.content().get(2).deviation()).isEqualByComparingTo("8.33");
        assertThat(page.content().get(3).deviation()).isEqualByComparingTo("-5.00");
        DeviationRow insufficient = page.content().get(4);
        assertThat(insufficient.avgRate()).isNull();
        assertThat(insufficient.deviation()).isNull();
        // 5번 자신은 표본 부족이라 폴더 평균에는 원래 들어가지 않고, 비교 곡은 1~4 전부다: (95 + 80 + 90 + 70) / 4 = 83.75
        assertThat(insufficient.folderAvgRate()).isEqualByComparingTo("83.75");
    }

    @Test
    void 평균_정렬은_평균_높은_순이고_표본_부족은_맨_아래다() {
        sampleFolder();

        Page<DeviationRow> page = service.deviation(ADMIN, "avg", 0, 20);

        assertThat(page.content()).extracting(r -> r.chart().songDifficultyId()).containsExactly(1L, 3L, 2L, 4L, 5L);
    }

    @Test
    void 플레이어_정렬은_플레이어_많은_순_같으면_기록_많은_순이다() {
        sampleFolder();

        Page<DeviationRow> page = service.deviation(ADMIN, "players", 0, 20);

        // 3명인 1~4는 기록 건수(9 > 7 > 6 > 5) 순, 2명인 5가 마지막
        assertThat(page.content()).extracting(r -> r.chart().songDifficultyId()).containsExactly(2L, 3L, 4L, 1L, 5L);
    }

    @Test
    void 정렬을_주지_않으면_편차_큰_순이다() {
        sampleFolder();

        assertThat(service.deviation(ADMIN, null, 0, 20).content().get(0).chart().songDifficultyId()).isEqualTo(4L);
    }

    @Test
    void 폴더에_비교할_곡이_2개뿐이면_폴더_평균과_편차가_null이다() {
        aggregates(agg(1, "7.0", 3, 5, "285", 0), agg(2, "7.0", 3, 5, "240", 0), agg(3, "7.0", 3, 5, "270", 0));

        Page<DeviationRow> page = service.deviation(ADMIN, "deviation", 0, 20);

        assertThat(page.content()).hasSize(3);
        assertThat(page.content()).allSatisfy(r -> {
            assertThat(r.avgRate()).isNotNull();
            assertThat(r.folderAvgRate()).isNull();
            assertThat(r.deviation()).isNull();
        });
    }

    @Test
    void 페이지네이션은_정렬된_전체에서_자르고_전체_개수를_알려_준다() {
        sampleFolder();

        Page<DeviationRow> second = service.deviation(ADMIN, "avg", 1, 2);

        assertThat(second.page()).isEqualTo(1);
        assertThat(second.size()).isEqualTo(2);
        assertThat(second.totalElements()).isEqualTo(5);
        assertThat(second.totalPages()).isEqualTo(3);
        assertThat(second.content()).extracting(r -> r.chart().songDifficultyId()).containsExactly(2L, 4L);
        // 범위 밖 쪽은 빈 목록, 크기는 1~100으로 맞춘다
        assertThat(service.deviation(ADMIN, "avg", 9, 2).content()).isEmpty();
        assertThat(service.deviation(ADMIN, "avg", 0, 1000).size()).isEqualTo(ChartStatsService.MAX_PAGE_SIZE);
        assertThat(service.deviation(ADMIN, "avg", -3, 0).page()).isZero();
    }

    @Test
    void 응답에_집계_기준이_들어_있다() {
        sampleFolder();

        var meta = service.deviation(ADMIN, null, 0, 20).meta();

        assertThat(meta.publicUsers()).isEqualTo(12);
        assertThat(meta.minPlayers()).isEqualTo(3);
        assertThat(meta.minFolderCharts()).isEqualTo(3);
        assertThat(meta.recentDays()).isEqualTo(7);
    }

    // ---- 인기 / 미정 / 폴더

    @Test
    void 인기_전체는_저장_횟수_많은_순이고_미정도_포함한다() {
        sampleFolder();

        Page<PopularityRow> all = service.popularity(ADMIN, "all", 0, 20);

        assertThat(all.content()).extracting(r -> r.chart().songDifficultyId()).containsExactly(5L, 6L, 2L, 3L, 4L, 1L);
        assertThat(all.content().get(0).records()).isEqualTo(20);
        assertThat(all.content().get(0).players()).isEqualTo(2);
    }

    @Test
    void 인기_최근_7일은_증가분이_있는_채보만_증가분_많은_순이다() {
        sampleFolder();

        Page<PopularityRow> recent = service.popularity(ADMIN, "7d", 0, 20);

        assertThat(recent.content()).extracting(r -> r.chart().songDifficultyId()).containsExactly(3L, 6L, 1L, 4L);
        assertThat(recent.content()).extracting(PopularityRow::recentRecords).containsExactly(4L, 3L, 2L, 1L);
    }

    @Test
    void 최근_7일의_시작은_서울_달력_기준_오늘_포함_7일의_0시다() {
        // 2026-11-14 12:00 KST -> 11-08 00:00 KST = 11-07 15:00 UTC
        assertThat(service.sinceUtc()).isEqualTo(LocalDateTime.of(2026, 11, 7, 15, 0));
        // 서울 날짜가 바뀌는 경계: 2026-11-13 23:50 KST(= 14:50 UTC)는 아직 13일이라 11-07 00:00 KST = 11-06 15:00 UTC
        ChartStatsService before = new ChartStatsService(userRepository, statsMapper, skillService, tableRepository,
                Clock.fixed(Instant.parse("2026-11-13T14:50:00Z"), ZoneOffset.UTC));
        assertThat(before.sinceUtc()).isEqualTo(LocalDateTime.of(2026, 11, 6, 15, 0));
        // 00:10 KST(= 15:10 UTC)는 벌써 14일
        ChartStatsService after = new ChartStatsService(userRepository, statsMapper, skillService, tableRepository,
                Clock.fixed(Instant.parse("2026-11-13T15:10:00Z"), ZoneOffset.UTC));
        assertThat(after.sinceUtc()).isEqualTo(LocalDateTime.of(2026, 11, 7, 15, 0));
    }

    @Test
    void 집계_쿼리에_계산한_7일_시작_시각이_전달된다() {
        aggregates();

        service.popularity(ADMIN, "7d", 0, 20);

        ArgumentCaptor<LocalDateTime> since = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(statsMapper).findChartAggregates(eq(SRN_PLUS), eq(TABLE_ID), since.capture());
        assertThat(since.getValue()).isEqualTo(LocalDateTime.of(2026, 11, 7, 15, 0));
    }

    @Test
    void 미정_목록은_기준_난이도가_없는_채보만_나온다() {
        sampleFolder();

        Page<UndecidedRow> page = service.undecided(ADMIN, 0, 20);

        assertThat(page.content()).hasSize(1);
        assertThat(page.content().get(0).chart().songDifficultyId()).isEqualTo(6L);
        assertThat(page.content().get(0).chart().tier()).isNull();
        assertThat(page.content().get(0).records()).isEqualTo(11);
        assertThat(page.content().get(0).players()).isEqualTo(4);
    }

    @Test
    void 폴더_목록은_기준_난이도_오름차순이고_표본_부족_폴더는_증감에서_건너뛴다() {
        aggregates(
                agg(1, "5.8", 3, 3, "270", 0), agg(2, "5.8", 3, 3, "240", 0), agg(3, "5.8", 3, 3, "210", 0),   // 평균 90, 80, 70 -> 폴더 80
                agg(4, "5.9", 3, 3, "264", 0),                                                                  // 표본 충분 곡 1개 -> 폴더 표본 부족
                agg(5, "6.0", 3, 3, "225", 0), agg(6, "6.0", 3, 3, "210", 0), agg(7, "6.0", 3, 3, "195", 0));  // 75, 70, 65 -> 폴더 70
        when(statsMapper.findFolderChartCounts(TABLE_ID)).thenReturn(List.of(
                new FolderChartCountRow(d("6.0"), 6), new FolderChartCountRow(d("5.8"), 4), new FolderChartCountRow(d("5.9"), 5)));

        Page<FolderRow> page = service.folders(ADMIN, 0, 100);

        assertThat(page.content()).extracting(FolderRow::tier).usingElementComparator(BigDecimal::compareTo)
                .containsExactly(d("5.8"), d("5.9"), d("6.0"));
        assertThat(page.content().get(0).chartCount()).isEqualTo(4);
        assertThat(page.content().get(0).avgRate()).isEqualByComparingTo("80.00");
        assertThat(page.content().get(0).deltaFromPrevious()).isNull();
        assertThat(page.content().get(1).avgRate()).isNull();
        assertThat(page.content().get(1).sampledCharts()).isEqualTo(1);
        assertThat(page.content().get(2).avgRate()).isEqualByComparingTo("70.00");
        assertThat(page.content().get(2).deltaFromPrevious()).isEqualByComparingTo("-10.00");
    }

    // ---- 채보 요약

    private void chartInfo(long id, String tier) {
        when(statsMapper.findChartInfo(id, TABLE_ID)).thenReturn(new ChartInfoRow(id, 100 + id, "곡" + id, "GUITAR", "MASTER", d("9.50"),
                tier == null ? null : d(tier)));
    }

    private static ChartPlayerRow player(long userId, String rate, long plays) {
        return new ChartPlayerRow(userId, "nick" + userId, d(rate), plays, LocalDateTime.of(2026, 11, 10, 3, 0));
    }

    @Test
    void 요약은_인원_기록_수_평균_중앙값_폴더_평균_편차를_담는다() {
        sampleFolder();
        chartInfo(1, "6.0");
        when(statsMapper.findPlayerRows(eq(SRN_PLUS), eq(1L), any())).thenReturn(List.of(
                player(10, "100.00", 2), player(11, "90.00", 1), player(12, "95.00", 2)));

        Summary s = service.summary(ADMIN, 1L);

        // 평균 (100 + 90 + 95) / 3 = 95, 중앙값 95, 기록 수 2 + 1 + 2 = 5, 폴더 평균(자기 제외 2·3·4 = 80, 90, 70) = 80, 편차 +15
        assertThat(s.players()).isEqualTo(3);
        assertThat(s.records()).isEqualTo(5);
        assertThat(s.avgRate()).isEqualByComparingTo("95.00");
        assertThat(s.medianRate()).isEqualByComparingTo("95.00");
        assertThat(s.folderAvgRate()).isEqualByComparingTo("80.00");
        assertThat(s.deviation()).isEqualByComparingTo("15.00");
        assertThat(s.folderSampleCharts()).isEqualTo(3);
    }

    @Test
    void 요약은_플레이어가_2명이면_평균_중앙값_편차가_null이다() {
        sampleFolder();
        chartInfo(5, "6.0");
        when(statsMapper.findPlayerRows(eq(SRN_PLUS), eq(5L), any())).thenReturn(List.of(player(10, "80.00", 3), player(11, "90.00", 1)));

        Summary s = service.summary(ADMIN, 5L);

        assertThat(s.players()).isEqualTo(2);
        assertThat(s.records()).isEqualTo(4);
        assertThat(s.avgRate()).isNull();
        assertThat(s.medianRate()).isNull();
        assertThat(s.deviation()).isNull();
    }

    @Test
    void 기록이_없는_채보와_미정_채보도_요약이_나온다() {
        aggregates();
        chartInfo(7, null);
        when(statsMapper.findPlayerRows(eq(SRN_PLUS), eq(7L), any())).thenReturn(List.of());

        Summary s = service.summary(ADMIN, 7L);

        assertThat(s.players()).isZero();
        assertThat(s.avgRate()).isNull();
        assertThat(s.folderAvgRate()).isNull();
        assertThat(s.chart().tier()).isNull();
    }

    @Test
    void 없는_채보는_404다() {
        aggregates();
        when(statsMapper.findChartInfo(77L, TABLE_ID)).thenReturn(null);

        assertThatThrownBy(() -> service.summary(ADMIN, 77L)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.NOT_FOUND);
        assertThatThrownBy(() -> service.players(ADMIN, 77L, null, 0, 20)).isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.NOT_FOUND);
    }

    // ---- 채보별 공개 유저 목록 (총점·티어는 한 번에)

    private static SkillService.RatedSkill rated(String total, String tierKey) {
        PlayerTierResponse tier = new PlayerTierResponse(tierKey, tierKey.toUpperCase(), 0, null, null);
        SkillResponse skill = new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, d(total), d(total), BigDecimal.ZERO, tier, 15, 25, List.of(), List.of());
        return new SkillService.RatedSkill(skill, null);
    }

    /** ratedBatch가 받은 id마다 총점 = id (그래서 총점 정렬은 id 큰 순이 된다). */
    @SuppressWarnings("unchecked")
    private void ratedBatchByUserId() {
        lenient().when(skillService.ratedBatch(anyCollection())).thenAnswer(inv -> {
            Map<Long, SkillService.RatedSkill> map = new LinkedHashMap<>();
            for (Long id : (Collection<Long>) inv.getArgument(0)) {
                map.put(id, rated(id + ".00", "t" + id));
            }
            return map;
        });
    }

    private List<ChartPlayerRow> thirtyPlayers() {
        List<ChartPlayerRow> rows = new ArrayList<>();
        for (long i = 1; i <= 30; i++) {
            // 최고 달성률은 i가 클수록 낮고(100 - i), 횟수는 i가 클수록 많다
            rows.add(player(i, String.valueOf(100 - i) + ".00", i));
        }
        return rows;
    }

    @Test
    @SuppressWarnings("unchecked")
    void 유저가_30명이어도_총점_티어_계산은_후보_쿼리_한_번이다() {
        chartInfo(1, "6.0");
        aggregates();
        when(statsMapper.findPlayerRows(eq(SRN_PLUS), eq(1L), any())).thenReturn(thirtyPlayers());
        ratedBatchByUserId();

        Page<PlayerRow> page = service.players(ADMIN, 1L, "rate", 0, 20);

        assertThat(page.totalElements()).isEqualTo(30);
        assertThat(page.content()).hasSize(20);
        // 한 번에 가져온다: 유저마다 계산하는 ratedAll은 부르지 않고, ratedBatch는 이번 페이지의 20명을 담아 딱 한 번 부른다
        verify(skillService, times(1)).ratedBatch(anyCollection());
        verify(skillService, never()).ratedAll(anyCollection());
        verify(skillService, never()).rated(anyLong());
        verify(statsMapper, times(1)).findPlayerRows(anyString(), anyLong(), any());
        ArgumentCaptor<Collection<Long>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(skillService).ratedBatch(ids.capture());
        assertThat(ids.getValue()).hasSize(20);
    }

    @Test
    void 총점_정렬은_전원의_총점을_한_번에_구해서_정렬한다() {
        chartInfo(1, "6.0");
        aggregates();
        when(statsMapper.findPlayerRows(eq(SRN_PLUS), eq(1L), any())).thenReturn(thirtyPlayers());
        ratedBatchByUserId();

        Page<PlayerRow> page = service.players(ADMIN, 1L, "score", 0, 5);

        verify(skillService, times(1)).ratedBatch(anyCollection());
        assertThat(page.content()).extracting(PlayerRow::userId).containsExactly(30L, 29L, 28L, 27L, 26L);
        assertThat(page.content().get(0).totalScore()).isEqualByComparingTo("30.00");
        assertThat(page.content().get(0).tier().key()).isEqualTo("t30");
    }

    @Test
    void 달성률_정렬과_횟수_정렬() {
        chartInfo(1, "6.0");
        aggregates();
        when(statsMapper.findPlayerRows(eq(SRN_PLUS), eq(1L), any())).thenReturn(thirtyPlayers());
        ratedBatchByUserId();

        assertThat(service.players(ADMIN, 1L, null, 0, 3).content()).extracting(PlayerRow::userId).containsExactly(1L, 2L, 3L);     // 달성률 높은 순(기본)
        assertThat(service.players(ADMIN, 1L, "plays", 0, 3).content()).extracting(PlayerRow::userId).containsExactly(30L, 29L, 28L); // 횟수 많은 순
        assertThat(service.players(ADMIN, 1L, "rate", 1, 3).content()).extracting(PlayerRow::userId).containsExactly(4L, 5L, 6L);    // 2쪽
    }

    @Test
    void 유저_줄에는_닉네임_티어_총점_최고_달성률_횟수_마지막_플레이만_있다() {
        chartInfo(1, "6.0");
        aggregates();
        when(statsMapper.findPlayerRows(eq(SRN_PLUS), eq(1L), any())).thenReturn(List.of(player(10, "93.456", 4)));
        ratedBatchByUserId();

        PlayerRow row = service.players(ADMIN, 1L, null, 0, 20).content().get(0);

        assertThat(row.userId()).isEqualTo(10L);
        assertThat(row.nickname()).isEqualTo("nick10");
        assertThat(row.bestRate()).isEqualByComparingTo("93.46");
        assertThat(row.playCount()).isEqualTo(4);
        assertThat(row.lastPlayedAt()).isEqualTo(Instant.parse("2026-11-10T03:00:00Z"));
    }

    @Test
    void 총점을_계산할_수_없는_유저는_0점으로_나온다() {
        chartInfo(1, "6.0");
        aggregates();
        when(statsMapper.findPlayerRows(eq(SRN_PLUS), eq(1L), any())).thenReturn(List.of(player(10, "90.00", 1)));
        when(skillService.ratedBatch(anyCollection())).thenReturn(Map.of());

        PlayerRow row = service.players(ADMIN, 1L, null, 0, 20).content().get(0);

        assertThat(row.totalScore()).isEqualByComparingTo("0");
        assertThat(row.tier()).isNull();
    }
}
