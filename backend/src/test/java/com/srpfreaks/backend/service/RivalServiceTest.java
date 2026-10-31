package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.RivalChartRow;
import com.srpfreaks.backend.dto.RivalCompareChartsResponse;
import com.srpfreaks.backend.dto.RivalCompareRatingResponse;
import com.srpfreaks.backend.dto.RivalCounts;
import com.srpfreaks.backend.dto.RivalRecordResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Rival;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
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

    // ---------- 곡별 승패 ----------

    @Test
    void 둘_다_기록_있는_채보만_승패를_세고_상대만_있으면_상대만이다() {
        Map<Long, ChartBest> mine = Map.of(
                1L, new ChartBest(1L, d("95.00"), d("9.00")),     // 이김
                2L, new ChartBest(2L, d("90.00"), d("9.00")),     // 짐
                3L, new ChartBest(3L, d("88.00"), d("9.00")),     // 같음
                4L, new ChartBest(4L, d("70.00"), d("9.00")));    // 나만 → 세지 않음
        Map<Long, ChartBest> theirs = Map.of(
                1L, new ChartBest(1L, d("94.99"), d("9.00")),
                2L, new ChartBest(2L, d("91.00"), d("9.00")),
                3L, new ChartBest(3L, d("88.00"), d("9.00")),
                5L, new ChartBest(5L, d("80.00"), d("9.00")));    // 상대만

        assertThat(RivalService.counts(mine, theirs)).isEqualTo(new RivalCounts(1, 1, 1, 1));
    }

    @Test
    void 진_곡은_차이가_작은_순_같으면_레벨_높은_순으로_한_페이지만_곡_정보를_붙인다() {
        bests(ME, new ChartBest(1L, d("90.00"), d("8.00")), new ChartBest(2L, d("95.00"), d("9.50")),
                new ChartBest(3L, d("80.00"), d("9.90")));
        bests(THEM, new ChartBest(1L, d("91.00"), d("8.00")), new ChartBest(2L, d("96.00"), d("9.50")),
                new ChartBest(3L, d("90.00"), d("9.90")));
        when(songDifficultyRepository.findActiveWithSongByIdIn(any())).thenAnswer(inv -> {
            List<SongDifficulty> list = new ArrayList<>();
            for (Object id : (java.util.Collection<?>) inv.getArgument(0)) {
                list.add(chart((Long) id));
            }
            return list;
        });

        RivalCompareChartsResponse res = service.compareCharts(ME, THEM, "lose", 0, 2);

        assertThat(res.counts()).isEqualTo(new RivalCounts(0, 3, 0, 0));
        assertThat(res.page().totalElements()).isEqualTo(3);
        assertThat(res.page().content()).extracting(RivalChartRow::songDifficultyId).containsExactly(2L, 1L);
        assertThat(res.page().content().get(0).title()).isEqualTo("곡2");
        assertThat(res.page().content().get(0).diff()).isEqualByComparingTo("-1.00");
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

        RivalCompareRatingResponse res = service.compareRating(ME, THEM);

        RivalCompareRatingResponse.Row row = res.single().get(0);
        assertThat(row.myRate()).isEqualByComparingTo("95.00");
        assertThat(row.myScore()).isEqualByComparingTo("544.00");
        assertThat(row.diff()).isEqualByComparingTo("-6.00");
        assertThat(res.counts()).isEqualTo(new RivalCounts(0, 1, 0, 0));
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

        RivalCompareRatingResponse.Row row = service.compareRating(ME, THEM).single().get(0);
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
        when(optionRecordRepository.findBestRatesForUsers(eq(7L), eq(SRN), anyCollection()))
                .thenReturn(List.of(new UserBest(ME, d("96.40")), new UserBest(THEM, d("96.10"))));

        List<RivalRecordResponse> rows = service.rivalRecords(ME, 7L);

        assertThat(rows).extracting(RivalRecordResponse::nickname).containsExactly("Rumi", "ASTRA");
        assertThat(rows.get(0).diff()).isEqualByComparingTo("0.30");
        assertThat(rows.get(1).rate()).isNull();
        assertThat(rows.get(1).diff()).isNull();
    }
}
