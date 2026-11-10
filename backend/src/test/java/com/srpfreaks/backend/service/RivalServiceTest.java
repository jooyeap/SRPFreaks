package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.RivalChartRow;
import com.srpfreaks.backend.dto.RivalCompareChartsResponse;
import com.srpfreaks.backend.dto.RivalCompareRatingResponse;
import com.srpfreaks.backend.dto.RivalCounts;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RivalRecordResponse;
import com.srpfreaks.backend.dto.RivalRegistrantResponse;
import com.srpfreaks.backend.dto.RivalResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Rival;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import com.srpfreaks.backend.mapper.RatingCandidate;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.ChartBest;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RivalRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserBest;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 라이벌 등록·비교(D56). 나 = 1, 상대 = 2. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RivalServiceTest {

    static final Long ME = 1L;
    static final Long THEM = 2L;
    static final NoteOption SRN = NoteOption.SUPER_RANDOM_PLUS;

    @Mock RivalRepository rivalRepository;
    @Mock UserRepository userRepository;
    @Mock OptionRecordRepository optionRecordRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock AppSettingRepository appSettingRepository;
    @Mock SkillService skillService;

    RivalService service;
    User me;
    User them;

    @BeforeEach
    void setUp() {
        service = new RivalService(rivalRepository, userRepository, optionRecordRepository, songDifficultyRepository,
                appSettingRepository, skillService, Clock.fixed(Instant.parse("2026-10-31T06:00:00Z"), ZoneOffset.UTC));
        me = user(ME, "me");
        them = user(THEM, "Rumi");
        when(userRepository.findByIdAndProfilePublicTrueAndStatus(THEM, UserStatus.ACTIVE)).thenReturn(Optional.of(them));
        when(userRepository.findByIdAndProfilePublicTrueAndStatus(eq(99L), any())).thenReturn(Optional.empty());
        when(userRepository.getReferenceById(ME)).thenReturn(me);
        when(skillService.ratingNoteOption()).thenReturn(SRN);
        when(skillService.calculator()).thenReturn(new RatingCalculator(RatingCalculatorTest.defaults()));
        when(appSettingRepository.findAll()).thenReturn(List.of(
                AppSetting.create("rival.max_count", "5", null),
                AppSetting.create("rival.notify_delay_minutes", "10", null),
                AppSetting.create("rival.notify_daily_per_rival", "3", null),
                AppSetting.create("rival.notify_keep_days", "30", null)));
    }

    private static User user(Long id, String nickname) {
        User u = User.create("sub-" + id, id + "@example.com", nickname);
        ReflectionTestUtils.setField(u, "id", id);
        u.changeProfilePublic(true);
        return u;
    }

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    private void bests(Long userId, ChartBest... rows) {
        when(optionRecordRepository.findActiveBestByUser(userId, SRN)).thenReturn(List.of(rows));
    }

    // ---------- 등록 ----------

    @Test
    void 공개_유저를_등록한다() {
        service.register(ME, THEM);
        verify(rivalRepository).saveAndFlush(any(Rival.class));
    }

    @Test
    void 자기_자신은_400_비공개나_없는_유저는_404() {
        assertThatThrownBy(() -> service.register(ME, ME)).extracting("errorCode").isEqualTo(ErrorCode.BAD_REQUEST);
        assertThatThrownBy(() -> service.register(ME, 99L)).extracting("errorCode").isEqualTo(ErrorCode.NOT_FOUND);
        verify(rivalRepository, never()).saveAndFlush(any());
    }

    @Test
    void 이미_등록했으면_400_다섯명이_찼으면_409() {
        when(rivalRepository.existsByUser_IdAndTarget_Id(ME, THEM)).thenReturn(true);
        assertThatThrownBy(() -> service.register(ME, THEM)).extracting("errorCode").isEqualTo(ErrorCode.BAD_REQUEST);

        when(rivalRepository.existsByUser_IdAndTarget_Id(ME, THEM)).thenReturn(false);
        when(rivalRepository.countByUser_Id(ME)).thenReturn(5L);
        assertThatThrownBy(() -> service.register(ME, THEM)).isInstanceOf(ApiException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.RIVAL_LIMIT);
    }

    @Test
    void 비교_상대가_나_자신이면_404() {
        assertThatThrownBy(() -> service.compareCharts(ME, ME, null, 0, 20)).extracting("errorCode").isEqualTo(ErrorCode.NOT_FOUND);
    }

    // ---------- 나를 등록한 유저 (D63) ----------

    private SkillService.RatedSkill rated(String tierKey) {
        SkillResponse skill = new SkillResponse(SRN, d("0"), d("0"), d("0"),
                new SkillResponse.PlayerTierResponse(tierKey, tierKey, 0, null, null), 15, 25, List.of(), List.of());
        return new SkillService.RatedSkill(skill, null);
    }

    @Test
    void 나를_등록한_공개_유저만_담고_서로_라이벌은_내가_등록한_사람이다() {
        User u3 = user(3L, "Mika");
        User u4 = user(4L, "Sora");
        when(rivalRepository.findPublicRegistrants(eq(ME), eq(UserStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(them, u3, u4), org.springframework.data.domain.PageRequest.of(0, 20), 3));
        // 내 라이벌은 THEM(2)뿐 -> 2번만 서로 라이벌
        when(rivalRepository.findWithTargetByUserId(ME)).thenReturn(List.of(Rival.of(me, them, Instant.EPOCH)));
        when(skillService.ratedAll(List.of(THEM, 3L, 4L))).thenReturn(Map.of(
                THEM, rated("SS 3"), 3L, rated("S 1"), 4L, rated("A 2")));

        PageResponse<RivalRegistrantResponse> res = service.registeredMe(ME, 0, 20);

        assertThat(res.totalElements()).isEqualTo(3);
        assertThat(res.content()).extracting(RivalRegistrantResponse::userId).containsExactly(2L, 3L, 4L);
        assertThat(res.content()).extracting(RivalRegistrantResponse::mutual).containsExactly(true, false, false);
        assertThat(res.content().get(0).tier().key()).isEqualTo("SS 3");
    }

    @Test
    void 조회는_항상_본인_id로_하고_쪽수와_크기는_범위로_고친다() {
        when(rivalRepository.findPublicRegistrants(any(), any(), any(Pageable.class))).thenAnswer(inv ->
                new PageImpl<User>(List.of(), inv.getArgument(2), 0));

        PageResponse<RivalRegistrantResponse> res = service.registeredMe(ME, -3, 500);

        assertThat(res.content()).isEmpty();
        assertThat(res.totalElements()).isZero();
        assertThat(res.page()).isZero();
        assertThat(res.size()).isEqualTo(RivalService.MAX_PAGE_SIZE);
        verify(rivalRepository).findPublicRegistrants(eq(ME), eq(UserStatus.ACTIVE), eq(org.springframework.data.domain.PageRequest.of(0, 50)));
        verify(skillService, never()).ratedAll(any());
    }

    @Test
    void 마지막_쪽은_남은_줄만_담고_합계는_공개_유저_수다() {
        Page<User> page = new PageImpl<>(List.of(user(5L, "Last")), org.springframework.data.domain.PageRequest.of(2, 2), 5);
        when(rivalRepository.findPublicRegistrants(eq(ME), eq(UserStatus.ACTIVE), any(Pageable.class))).thenReturn(page);
        when(rivalRepository.findWithTargetByUserId(ME)).thenReturn(List.of());
        when(skillService.ratedAll(List.of(5L))).thenReturn(Map.of(5L, rated("C")));

        PageResponse<RivalRegistrantResponse> res = service.registeredMe(ME, 2, 2);

        assertThat(res.content()).hasSize(1);
        assertThat(res.totalElements()).isEqualTo(5);
        assertThat(res.totalPages()).isEqualTo(3);
        assertThat(res.content().get(0).mutual()).isFalse();
    }

    // ---------- 곡별 승패 ----------

    /** 후보 한 줄(레이팅 대상 채보 + 최고 달성률). 점수는 이 테스트에서 쓰지 않아 0으로 둔다. */
    private static SkillService.ScoredChart scored(long id, PatternType pattern, String level, String rate) {
        RatingCandidate c = new RatingCandidate(id, 100 + id, "곡" + id, "GUITAR", "MASTER", d(level), d("5.6"),
                pattern.getLabel(), d(rate), false, null);
        return new SkillService.ScoredChart(c, pattern, d("0"));
    }

    private void scoredCharts(List<SkillService.ScoredChart> mine, List<SkillService.ScoredChart> theirs) {
        when(skillService.scoredChartsAll(any())).thenReturn(Map.of(ME, mine, THEM, theirs));
    }

    @Test
    void 진_곡은_차이가_작은_순_같으면_레벨_높은_순으로_한_페이지만_곡_정보를_준다() {
        scoredCharts(
                List.of(scored(1, PatternType.SINGLE, "8.00", "90.00"), scored(2, PatternType.TRIPLE, "9.50", "95.00"),
                        scored(3, PatternType.DOUBLE, "9.90", "80.00")),
                List.of(scored(1, PatternType.SINGLE, "8.00", "91.00"), scored(2, PatternType.TRIPLE, "9.50", "96.00"),
                        scored(3, PatternType.DOUBLE, "9.90", "90.00")));

        RivalCompareChartsResponse res = service.compareCharts(ME, THEM, "lose", 0, 2);

        assertThat(res.counts()).isEqualTo(new RivalCounts(0, 3, 0, 0, 0));
        assertThat(res.page().totalElements()).isEqualTo(3);
        // |diff| = 1.00(곡1, 레벨 8.00), 1.00(곡2, 레벨 9.50), 10.00(곡3) → 같은 차이는 레벨 높은 순이라 곡2가 먼저
        assertThat(res.page().content()).extracting(RivalChartRow::songDifficultyId).containsExactly(2L, 1L);
        assertThat(res.page().content().get(0).title()).isEqualTo("곡2");
        assertThat(res.page().content().get(0).diff()).isEqualByComparingTo("-1.00");
    }

    @Test
    void 곡별_승패의_개수는_대시보드_집계의_totals와_상대만_합계와_항상_같다() {
        // 레이팅 대상(속성 있음) 채보만 센다. 레이팅 제외 속성(EXCLUDED)은 집계에서 빠진다.
        List<SkillService.ScoredChart> mine = List.of(
                scored(1, PatternType.SINGLE, "9.00", "97.50"),      // 상대 99.80 → 패 (diff -2.30, 점수로는 같아도 달성률로는 패)
                scored(2, PatternType.TRIPLE, "9.00", "100.00"),     // 상대 100.00 → 무
                scored(3, PatternType.DOUBLE, "9.00", "90.00"),      // 상대 80.00 → 승
                scored(4, PatternType.COMPOUND, "9.00", "70.00"),    // 나만 → 승패에 안 센다 (나만 1)
                scored(6, PatternType.EXCLUDED, "9.00", "50.00"));   // 상대는 99.00이지만 레이팅 제외 → 빠진다
        List<SkillService.ScoredChart> theirs = List.of(
                scored(1, PatternType.SINGLE, "9.00", "99.80"),
                scored(2, PatternType.TRIPLE, "9.00", "100.00"),
                scored(3, PatternType.DOUBLE, "9.00", "80.00"),
                scored(5, PatternType.COMPOSITE_SINGLE, "9.00", "88.00"),   // 상대만 → 상대만 1
                scored(6, PatternType.EXCLUDED, "9.00", "99.00"));
        scoredCharts(mine, theirs);

        RivalCompareChartsResponse res = service.compareCharts(ME, THEM, "LOSE", 0, 20);
        RivalSummaryResponse summary = RivalSummaryCalculator.summarize(THEM, "Rumi",
                RivalSummaryCalculator.share(mine, theirs), RivalSummaryCalculator.unmatched(mine, theirs));

        // 같은 입력 → 곡별 승패 탭 개수 = 상단 요약 totals (불일치 회귀 방지)
        assertThat(res.counts().win()).isEqualTo(summary.totals().wins()).isEqualTo(1);
        assertThat(res.counts().tie()).isEqualTo(summary.totals().ties()).isEqualTo(1);
        assertThat(res.counts().lose()).isEqualTo(summary.totals().losses()).isEqualTo(1);
        // 상대만 탭 개수 = 속성별 onlyTheirs 합, 나만 = onlyMine 합
        assertThat(res.counts().theirsOnly()).isEqualTo(summary.patterns().stream().mapToInt(RivalSummaryResponse.PatternSummary::onlyTheirs).sum()).isEqualTo(1);
        assertThat(res.counts().onlyMine()).isEqualTo(summary.patterns().stream().mapToInt(RivalSummaryResponse.PatternSummary::onlyMine).sum()).isEqualTo(1);
        // 진 곡 목록: 97.50 대 99.80 → 패, diff -2.30
        assertThat(res.page().content()).extracting(RivalChartRow::songDifficultyId).containsExactly(1L);
        assertThat(res.page().content().get(0).diff()).isEqualByComparingTo("-2.30");
    }

    @Test
    void 이김_같음_상대만_탭은_같은_범위에서_고르고_정렬은_차이_절댓값_작은_순이다() {
        scoredCharts(
                List.of(scored(1, PatternType.SINGLE, "9.00", "95.00"), scored(2, PatternType.SINGLE, "9.00", "99.00"),
                        scored(3, PatternType.DOUBLE, "9.00", "88.00"), scored(4, PatternType.TRIPLE, "9.00", "100.00")),
                List.of(scored(1, PatternType.SINGLE, "9.00", "94.00"), scored(2, PatternType.SINGLE, "9.00", "98.50"),
                        scored(3, PatternType.DOUBLE, "9.00", "88.00"), scored(4, PatternType.TRIPLE, "9.00", "100.00"),
                        scored(5, PatternType.TRIPLE, "9.00", "70.00"), scored(6, PatternType.TRIPLE, "9.50", "90.00")));

        // 이김: 곡2(+0.50), 곡1(+1.00) 순
        assertThat(service.compareCharts(ME, THEM, "win", 0, 20).page().content())
                .extracting(RivalChartRow::songDifficultyId).containsExactly(2L, 1L);
        // 같음: 달성률이 정확히 같은 곡만(곡3, 곡4), 같은 차이(0)라 레벨 같으면 채보 id 순
        assertThat(service.compareCharts(ME, THEM, "tie", 0, 20).page().content())
                .extracting(RivalChartRow::songDifficultyId).containsExactly(3L, 4L);
        // 상대만: 상대 달성률 높은 순(곡6 90.00, 곡5 70.00), 내 달성률·차이는 null
        RivalCompareChartsResponse only = service.compareCharts(ME, THEM, "THEIRS_ONLY", 0, 20);
        assertThat(only.page().content()).extracting(RivalChartRow::songDifficultyId).containsExactly(6L, 5L);
        assertThat(only.page().content().get(0).myRate()).isNull();
        assertThat(only.page().content().get(0).diff()).isNull();
        assertThat(only.counts().theirsOnly()).isEqualTo(2);
    }

    @Test
    void 공유_곡이_없거나_한쪽_기록이_전무해도_개수는_0이고_목록은_비어_있다() {
        scoredCharts(List.of(), List.of(scored(1, PatternType.SINGLE, "9.00", "90.00")));
        RivalCompareChartsResponse res = service.compareCharts(ME, THEM, "LOSE", 0, 20);
        assertThat(res.counts()).isEqualTo(new RivalCounts(0, 0, 0, 1, 0));
        assertThat(res.page().content()).isEmpty();

        scoredCharts(List.of(scored(1, PatternType.SINGLE, "9.00", "90.00")), List.of());
        assertThat(service.compareCharts(ME, THEM, "THEIRS_ONLY", 0, 20).counts()).isEqualTo(new RivalCounts(0, 0, 0, 0, 1));
    }

    @Test
    void 결과_값이_화이트리스트_밖이면_400() {
        assertThatThrownBy(() -> service.compareCharts(ME, THEM, "DROP", 0, 20)).extracting("errorCode")
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    private static SongDifficulty chart(Long id) {
        Song song = Song.create("곡" + id, null, "test", null);
        ReflectionTestUtils.setField(song, "id", 100 + id);
        SongDifficulty dd = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, d("9.00"));
        ReflectionTestUtils.setField(dd, "id", id);
        return dd;
    }

    // ---------- 레이팅 비교 ----------

    @Test
    void 상대_레이팅_줄에_같은_기준_난이도로_계산한_내_점수와_차이를_붙인다() {
        // 기준 난이도 9.0 → R = 5x9-15 = 30. 내 95.00 → V = 30x80/100 + 3.2x15/15 = 27.2 → 점수 544.00
        SkillEntryResponse entry = new SkillEntryResponse(1, 7L, 70L, "KAISER PHOENIX", InstrumentPart.GUITAR,
                DifficultyType.MASTER, d("9.90"), d("9.0"), "단일", d("96.00"), false, AchievementStage.SS,
                d("30"), d("27.5"), d("550.00"));
        SkillResponse theirs = new SkillResponse(SRN, d("550.00"), d("550.00"), d("0"), null, 15, 25, List.of(entry), List.of());
        SkillResponse mine = new SkillResponse(SRN, d("544.00"), d("544.00"), d("0"), null, 15, 25, List.of(), List.of());
        when(skillService.ratedAll(List.of(THEM, ME))).thenReturn(Map.of(
                THEM, new SkillService.RatedSkill(theirs, null), ME, new SkillService.RatedSkill(mine, null)));
        bests(ME, new ChartBest(7L, d("95.00"), d("9.90")));
        bests(THEM, new ChartBest(7L, d("96.00"), d("9.90")));
        // 위쪽 개수는 대시보드와 같은 기준: 두 사람의 레이팅 대상 채보 점수 목록(달성률 95.00 대 96.00 → 패)
        scoredCharts(List.of(scored(7, PatternType.SINGLE, "9.90", "95.00")), List.of(scored(7, PatternType.SINGLE, "9.90", "96.00")));

        RivalCompareRatingResponse res = service.compareRating(ME, THEM);

        RivalCompareRatingResponse.Row row = res.single().get(0);
        assertThat(row.myRate()).isEqualByComparingTo("95.00");
        assertThat(row.myScore()).isEqualByComparingTo("544.00");
        assertThat(row.diff()).isEqualByComparingTo("-6.00");
        assertThat(row.pattern()).isEqualTo("단일");   // D65: 줄 윗줄의 `속성 | 서열 난이도`용
        assertThat(res.counts()).isEqualTo(new RivalCounts(0, 1, 0, 0, 0));
    }

    @Test
    void 내_기록이_없는_줄은_내_점수와_차이가_비어_있다() {
        SkillEntryResponse entry = new SkillEntryResponse(1, 7L, 70L, "X", InstrumentPart.GUITAR, DifficultyType.MASTER,
                d("9.90"), d("9.0"), "단일", d("96.00"), false, AchievementStage.SS, d("30"), d("27.5"), d("550.00"));
        SkillResponse theirs = new SkillResponse(SRN, d("550.00"), d("550.00"), d("0"), null, 15, 25, List.of(entry), List.of());
        SkillResponse mine = new SkillResponse(SRN, d("0"), d("0"), d("0"), null, 15, 25, List.of(), List.of());
        when(skillService.ratedAll(List.of(THEM, ME))).thenReturn(Map.of(
                THEM, new SkillService.RatedSkill(theirs, null), ME, new SkillService.RatedSkill(mine, null)));
        bests(ME);
        bests(THEM, new ChartBest(7L, d("96.00"), d("9.90")));
        scoredCharts(List.of(), List.of(scored(7, PatternType.SINGLE, "9.90", "96.00")));   // 상대만 기록 → 상대만 1

        RivalCompareRatingResponse res = service.compareRating(ME, THEM);
        assertThat(res.counts()).isEqualTo(new RivalCounts(0, 0, 0, 1, 0));
        RivalCompareRatingResponse.Row row = res.single().get(0);
        assertThat(row.myRate()).isNull();
        assertThat(row.myScore()).isNull();
        assertThat(row.diff()).isNull();
    }

    // ---------- 곡 상세 ----------

    @Test
    void 곡_상세의_라이벌_기록은_비공개가_된_라이벌을_빼고_내_기록과의_차이를_준다() {
        SongDifficulty c = chart(7L);
        when(songDifficultyRepository.findByIdAndDeletedFalse(7L)).thenReturn(Optional.of(c));
        User hidden = user(3L, "HSB");
        hidden.changeProfilePublic(false);
        User noRecord = user(4L, "ASTRA");
        when(rivalRepository.findWithTargetByUserId(ME)).thenReturn(List.of(
                Rival.of(me, them, Instant.EPOCH), Rival.of(me, hidden, Instant.EPOCH), Rival.of(me, noRecord, Instant.EPOCH)));
        when(optionRecordRepository.findBestWithFullComboForUsers(eq(7L), eq(SRN), anyCollection()))
                .thenReturn(List.of(new UserBest(ME, d("96.40")), new UserBest(THEM, d("96.10"), true)));

        List<RivalRecordResponse> rows = service.rivalRecords(ME, 7L);

        assertThat(rows).extracting(RivalRecordResponse::nickname).containsExactly("Rumi", "ASTRA");
        assertThat(rows.get(0).diff()).isEqualByComparingTo("0.30");
        assertThat(rows.get(1).rate()).isNull();
        assertThat(rows.get(1).diff()).isNull();
        // 달성 단계(D65): 풀콤보 기록이 있으면 FC, 기록이 없으면 null
        assertThat(rows.get(0).stage()).isEqualTo(AchievementStage.FC);
        assertThat(rows.get(1).stage()).isNull();
    }

    @Test
    void 곡_상세_라이벌_기록의_단계는_최고_달성률과_풀콤보_여부로_정한다() {
        SongDifficulty c = chart(7L);
        when(songDifficultyRepository.findByIdAndDeletedFalse(7L)).thenReturn(Optional.of(c));
        when(rivalRepository.findWithTargetByUserId(ME)).thenReturn(List.of(Rival.of(me, them, Instant.EPOCH)));
        // 풀콤보가 없고 96.10 → SS, 100.00이면 EXC
        when(optionRecordRepository.findBestWithFullComboForUsers(eq(7L), eq(SRN), anyCollection()))
                .thenReturn(List.of(new UserBest(THEM, d("96.10"))));
        assertThat(service.rivalRecords(ME, 7L).get(0).stage()).isEqualTo(AchievementStage.SS);

        when(optionRecordRepository.findBestWithFullComboForUsers(eq(7L), eq(SRN), anyCollection()))
                .thenReturn(List.of(new UserBest(THEM, d("100.00"))));
        assertThat(service.rivalRecords(ME, 7L).get(0).stage()).isEqualTo(AchievementStage.EXC);
    }

    // ---------- 라이벌 카드의 상대 상위 곡 (3단계, D65) ----------

    private static SkillEntryResponse top(int rank, long chartId, long songId, String value, String score) {
        return new SkillEntryResponse(rank, chartId, songId, "곡" + songId, InstrumentPart.GUITAR, DifficultyType.MASTER,
                d("9.50"), d("6.0"), "단일", d("96.00"), false, AchievementStage.SS, d("15"), d(value), d(score));
    }

    private static SkillResponse skillOf(List<SkillEntryResponse> single, List<SkillEntryResponse> other) {
        return new SkillResponse(SRN, d("1000.00"), d("500.00"), d("500.00"),
                new SkillResponse.PlayerTierResponse("C", "C", 0, null, null), 15, 25, single, other);
    }

    @Test
    void 상위_곡은_단일과_그_외를_합쳐_점수_높은_순_최대_5곡이다() {
        SkillResponse skill = skillOf(
                List.of(top(1, 10, 1, "15.2000", "304.00"), top(2, 11, 2, "14.0000", "280.00"), top(3, 12, 3, "12.0000", "240.00")),
                List.of(top(1, 20, 4, "15.0000", "300.00"), top(2, 21, 5, "13.0000", "260.00"), top(3, 22, 6, "11.0000", "220.00"),
                        top(4, 23, 7, "10.0000", "200.00")));

        List<RivalResponse.RivalTopSong> songs = RivalService.topSongsOf(skill);

        assertThat(songs).extracting(RivalResponse.RivalTopSong::songId).containsExactly(1L, 4L, 2L, 5L, 3L);
        assertThat(songs).extracting(RivalResponse.RivalTopSong::score)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(d("304.00"), d("300.00"), d("280.00"), d("260.00"), d("240.00"));
    }

    @Test
    void 곡이_5곡_미만이면_있는_만큼_없으면_빈_목록이다() {
        assertThat(RivalService.topSongsOf(skillOf(List.of(top(1, 10, 1, "15.2000", "304.00")), List.of()))).hasSize(1);
        assertThat(RivalService.topSongsOf(skillOf(List.of(), List.of()))).isEmpty();
    }

    @Test
    void 같은_곡의_채보가_둘이면_점수_높은_쪽_하나만_쓰고_동점은_채보_id가_작은_쪽이_먼저다() {
        SkillResponse skill = skillOf(
                List.of(top(1, 31, 7, "15.0000", "300.00"), top(2, 30, 8, "15.0000", "300.00")),
                List.of(top(1, 40, 7, "13.0000", "260.00")));   // 곡 7의 낮은 채보 -> 빠진다

        List<RivalResponse.RivalTopSong> songs = RivalService.topSongsOf(skill);

        // V가 같으면 채보 id가 작은 30(곡 8)이 먼저, 곡 7은 한 번만
        assertThat(songs).extracting(RivalResponse.RivalTopSong::songId).containsExactly(8L, 7L);
        assertThat(songs.get(1).score()).isEqualByComparingTo("300.00");
    }

    @Test
    void 라이벌_목록은_상대_상위_곡을_담고_비공개_상대는_null이며_레이팅은_한_번에_계산한다() {
        User hidden = user(3L, "Hidden");
        hidden.changeProfilePublic(false);
        when(rivalRepository.findWithTargetByUserId(ME)).thenReturn(List.of(
                Rival.of(me, them, Instant.EPOCH), Rival.of(me, hidden, Instant.EPOCH)));
        when(rivalRepository.findUserIdsRegistering(ME)).thenReturn(List.of());
        SkillResponse theirs = skillOf(List.of(top(1, 10, 1, "15.2000", "304.00")), List.of(top(1, 20, 2, "12.0000", "240.00")));
        SkillResponse mine = skillOf(List.of(), List.of());
        when(skillService.ratedAll(List.of(THEM, ME))).thenReturn(Map.of(
                THEM, new SkillService.RatedSkill(theirs, null), ME, new SkillService.RatedSkill(mine, null)));
        // 카드의 승·패·무는 대시보드와 같은 기준(레이팅 대상 채보 전체, 달성률 차): 90.00 대 91.00 → 패 1
        scoredCharts(List.of(scored(1, PatternType.SINGLE, "9.00", "90.00")), List.of(scored(1, PatternType.SINGLE, "9.00", "91.00")));

        List<RivalResponse> rows = service.list(ME);

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).available()).isTrue();
        assertThat(rows.get(0).topSongs()).extracting(RivalResponse.RivalTopSong::songId).containsExactly(1L, 2L);
        assertThat(rows.get(1).available()).isFalse();
        assertThat(rows.get(1).topSongs()).isNull();
        assertThat(rows.get(0).counts()).isEqualTo(new RivalCounts(0, 1, 0, 0, 0));
        assertThat(rows.get(1).counts()).isNull();
        // 라이벌이 여러 명이어도 레이팅 계산과 채보 점수 목록 읽기는 각각 한 번에(비공개 상대는 계산 대상에서도 빠진다)
        verify(skillService, org.mockito.Mockito.times(1)).ratedAll(any());
        verify(skillService, org.mockito.Mockito.times(1)).scoredChartsAll(any());
    }

    @Test
    void 카드_비교_목록_곡별_승패의_개수는_대시보드_요약과_항상_같다_불일치_회귀_방지() {
        // 같은 입력: 레이팅 대상 5개 속성의 채보 + 레이팅 제외 채보 + 나만/상대만 곡
        List<SkillService.ScoredChart> mine = List.of(
                scored(1, PatternType.SINGLE, "9.00", "97.50"),       // 상대 99.80 → 패 (점수로는 같아도 달성률로는 패)
                scored(2, PatternType.TRIPLE, "9.00", "100.00"),      // 상대 100.00 → 무
                scored(3, PatternType.DOUBLE, "9.00", "90.00"),       // 상대 80.00 → 승
                scored(4, PatternType.COMPOUND, "9.00", "70.00"),     // 나만
                scored(6, PatternType.EXCLUDED, "9.00", "50.00"));    // 레이팅 제외 → 어디에도 안 센다
        List<SkillService.ScoredChart> theirs = List.of(
                scored(1, PatternType.SINGLE, "9.00", "99.80"),
                scored(2, PatternType.TRIPLE, "9.00", "100.00"),
                scored(3, PatternType.DOUBLE, "9.00", "80.00"),
                scored(5, PatternType.COMPOSITE_SINGLE, "9.00", "88.00"),   // 상대만
                scored(6, PatternType.EXCLUDED, "9.00", "99.00"));
        scoredCharts(mine, theirs);
        when(rivalRepository.findWithTargetByUserId(ME)).thenReturn(List.of(Rival.of(me, them, Instant.EPOCH)));
        when(rivalRepository.findUserIdsRegistering(ME)).thenReturn(List.of());
        SkillResponse skill = skillOf(List.of(), List.of());
        when(skillService.ratedAll(List.of(THEM, ME))).thenReturn(Map.of(
                THEM, new SkillService.RatedSkill(skill, null), ME, new SkillService.RatedSkill(skill, null)));
        bests(ME);
        bests(THEM);

        RivalSummaryResponse summary = RivalSummaryCalculator.summarize(THEM, "Rumi",
                RivalSummaryCalculator.share(mine, theirs), RivalSummaryCalculator.unmatched(mine, theirs));
        RivalCounts expected = new RivalCounts(summary.totals().wins(), summary.totals().losses(), summary.totals().ties(),
                summary.patterns().stream().mapToInt(RivalSummaryResponse.PatternSummary::onlyTheirs).sum(),
                summary.patterns().stream().mapToInt(RivalSummaryResponse.PatternSummary::onlyMine).sum());
        assertThat(expected).isEqualTo(new RivalCounts(1, 1, 1, 1, 1));

        // 라이벌 카드(GET /rivals), 비교 레이팅 목록, 곡별 승패 보기 — 세 곳 모두 대시보드 요약과 같은 숫자
        assertThat(service.list(ME).get(0).counts()).isEqualTo(expected);
        assertThat(service.compareRating(ME, THEM).counts()).isEqualTo(expected);
        assertThat(service.compareCharts(ME, THEM, "LOSE", 0, 20).counts()).isEqualTo(expected);
    }
}
