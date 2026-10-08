package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.PlayerTier;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.RatingCandidate;
import com.srpfreaks.backend.mapper.SkillMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.PlayerTierRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 레이팅 목록 계산을 직접 계산한 예시값으로 검증한다. 기본 설정(15 / 25)은 테스트 편의상 작은 개수로 바꿔서 쓴다. */
@ExtendWith(MockitoExtension.class)
class SkillServiceTest {

    static final Long USER = 7L;
    static final Long TABLE_ID = 1L;

    @Mock AppSettingRepository settingRepository;
    @Mock DifficultyTableRepository tableRepository;
    @Mock PlayerTierRepository tierRepository;
    @Mock SkillMapper skillMapper;

    SkillService service;
    DifficultyTable table;

    @BeforeEach
    void setUp() {
        service = new SkillService(settingRepository, tableRepository, tierRepository, skillMapper);
        table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        ReflectionTestUtils.setField(table, "id", TABLE_ID);
    }

    // ---- 준비용 도우미

    private void settings(int single, int other) {
        List<AppSetting> list = new ArrayList<>();
        String[][] values = {{"pivot", "6.0"}, {"high_slope", "5"}, {"high_offset", "15"}, {"low_slope", "10"},
                {"low_offset", "45"}, {"cap_rate", "80"}, {"max_rate", "95"}, {"bonus", "3.2"},
                {"score_multiplier", "20"}, {"list_single", String.valueOf(single)},
                {"list_other", String.valueOf(other)}, {"note_option", "SUPER_RANDOM_PLUS"}};
        for (String[] v : values) {
            list.add(AppSetting.create("rating." + v[0], v[1], null));
        }
        list.add(AppSetting.create("ui.show_song_images", "false", null));   // rating.*가 아닌 설정은 무시된다
        when(settingRepository.findAll()).thenReturn(list);
    }

    private void tableExists() {
        when(tableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE))
                .thenReturn(Optional.of(table));
    }

    private void tiers(int... minScores) {
        List<PlayerTier> list = new ArrayList<>();
        for (int i = 0; i < minScores.length; i++) {
            PlayerTier t = BeanUtils.instantiateClass(PlayerTier.class);
            ReflectionTestUtils.setField(t, "tierKey", "T" + minScores[i]);
            ReflectionTestUtils.setField(t, "displayName", "Tier" + minScores[i]);
            ReflectionTestUtils.setField(t, "minScore", minScores[i]);
            ReflectionTestUtils.setField(t, "sortOrder", i + 1);
            list.add(t);
        }
        when(tierRepository.findAllByOrderBySortOrderAsc()).thenReturn(list);
    }

    private void candidates(RatingCandidate... rows) {
        when(skillMapper.findRatingCandidates(any(), any(), any(), any())).thenReturn(List.of(rows));
    }

    private static RatingCandidate cand(long id, long songId, PatternType pattern, String tier, String rate) {
        return cand(id, songId, pattern.getLabel(), tier, rate, false);
    }

    private static RatingCandidate cand(long id, long songId, String pattern, String tier, String rate, boolean fc) {
        return cand(id, songId, pattern, tier, rate, fc, null);
    }

    private static RatingCandidate cand(long id, long songId, String pattern, String tier, String rate, boolean fc,
                                        LocalDateTime achievedAt) {
        return new RatingCandidate(id, songId, "곡" + songId, "GUITAR", "MASTER", new BigDecimal("9.50"),
                tier == null ? null : new BigDecimal(tier), pattern, new BigDecimal(rate), fc, achievedAt);
    }

    // ---- 테스트

    @Test
    void 단일과_그_외를_나눠_각각_상위_N개를_뽑고_합산한다() {
        settings(2, 3);
        tableExists();
        tiers(0, 500, 1000, 1500, 2000);
        candidates(
                // 단일: V 높은 순 = S2(16.0) > S1(15.2) > S3(7.2). 상위 2개만
                cand(1, 10, PatternType.SINGLE, "6.0", "95.00"),     // R=15,  V=12+3.2   = 15.2 -> 304.00
                cand(2, 11, PatternType.SINGLE, "7.0", "80.00"),     // R=20,  V=16.0              -> 320.00
                cand(3, 12, PatternType.SINGLE, "5.0", "100.00"),    // R=5,   V=4+3.2     = 7.2   -> 144.00 (탈락)
                // 그 외: 복합/이중/삼중이 한 그룹. 상위 3개만
                cand(4, 10, PatternType.COMPOUND, "6.5", "100.00"),  // R=17.5, V=14+3.2   = 17.2  -> 344.00
                cand(5, 13, PatternType.DOUBLE, "6.0", "95.00"),     // 15.2 -> 304.00
                cand(6, 14, PatternType.TRIPLE, "6.0", "95.00"),     // 15.2 -> 304.00 (동점: id 작은 5가 먼저)
                cand(7, 15, PatternType.COMPOUND, "5.0", "40.00"));  // R=5,   V=2.0       -> 40.00 (탈락)

        SkillResponse response = service.mySkill(USER);

        assertThat(response.single()).extracting(SkillEntryResponse::songDifficultyId).containsExactly(2L, 1L);
        assertThat(response.other()).extracting(SkillEntryResponse::songDifficultyId).containsExactly(4L, 5L, 6L);
        assertThat(response.single()).extracting(SkillEntryResponse::rank).containsExactly(1, 2);
        assertThat(response.other()).extracting(SkillEntryResponse::rank).containsExactly(1, 2, 3);
        assertThat(response.singleScore()).isEqualByComparingTo("624.00");     // 320 + 304
        assertThat(response.otherScore()).isEqualByComparingTo("952.00");      // 344 + 304 + 304
        assertThat(response.totalScore()).isEqualByComparingTo("1576.00");
        assertThat(response.singleLimit()).isEqualTo(2);
        assertThat(response.otherLimit()).isEqualTo(3);
    }

    @Test
    void 합계는_반올림하기_전_점수로_더하고_표시할_때만_둘째_자리로_반올림한다() {
        settings(2, 5);
        tableExists();
        tiers(0);
        // T=5.9 (R=14), A=80.09: V = 11.2 + 3.2 x 0.09/15 = 11.2192 -> 점수 224.384 -> 표시 224.38
        // 두 채보의 표시 점수를 더하면 448.76이지만, 반올림 전 합 448.768을 반올림한 합계는 448.77이다.
        candidates(cand(1, 10, PatternType.SINGLE, "5.9", "80.09"), cand(2, 11, PatternType.SINGLE, "5.9", "80.09"));

        SkillResponse response = service.mySkill(USER);

        assertThat(response.single()).extracting(SkillEntryResponse::score).allSatisfy(
                s -> assertThat(s).isEqualByComparingTo("224.38"));
        assertThat(response.singleScore()).isEqualByComparingTo("448.77");
        assertThat(response.totalScore()).isEqualByComparingTo("448.77");
    }

    @Test
    void 티어는_반올림_전_합계의_정수부로_판정한다() {
        settings(2, 5);
        tableExists();
        tiers(0, 449);
        // 합계 448.768 -> 표시는 448.77이지만 정수부는 448이므로 449 구간에 못 미친다(소수 버림, D20)
        candidates(cand(1, 10, PatternType.SINGLE, "5.9", "80.09"), cand(2, 11, PatternType.SINGLE, "5.9", "80.09"));

        assertThat(service.mySkill(USER).tier().minScore()).isZero();
    }

    @Test
    void 같은_곡의_다른_채보도_각각_센다() {
        settings(5, 5);
        tableExists();
        tiers(0);
        // 곡 10의 채보 두 개(id 1, 2)가 모두 단일 목록에 들어간다 (곡당 1채보로 거르지 않는다)
        candidates(cand(1, 10, PatternType.SINGLE, "6.0", "95.00"), cand(2, 10, PatternType.SINGLE, "6.0", "90.00"));

        SkillResponse response = service.mySkill(USER);

        assertThat(response.single()).hasSize(2);
        assertThat(response.single()).extracting(SkillEntryResponse::songId).containsExactly(10L, 10L);
    }

    @Test
    void 목록이_모자라면_있는_만큼만_합산한다() {
        settings(15, 25);
        tableExists();
        tiers(0, 500);
        candidates(cand(1, 10, PatternType.SINGLE, "6.0", "95.00"));

        SkillResponse response = service.mySkill(USER);

        assertThat(response.single()).hasSize(1);
        assertThat(response.other()).isEmpty();
        assertThat(response.totalScore()).isEqualByComparingTo("304.00");
    }

    @Test
    void 항목은_R_V_점수와_달성_단계를_담는다() {
        settings(1, 1);
        tableExists();
        tiers(0);
        candidates(cand(1, 10, "단일", "7.0", "96.00", true));   // R=20, V=16+3.2 = 19.2 -> 384.00, FC

        SkillEntryResponse e = service.mySkill(USER).single().get(0);

        assertThat(e.ratingConstant()).isEqualByComparingTo("20");
        assertThat(e.value()).isEqualByComparingTo("19.2");
        assertThat(e.score()).isEqualByComparingTo("384.00");
        assertThat(e.tier()).isEqualByComparingTo("7.0");
        assertThat(e.stage()).isEqualTo(AchievementStage.FC);
        assertThat(e.pattern()).isEqualTo("단일");
        assertThat(e.achievementRate()).isEqualByComparingTo("96.00");
    }

    @Test
    void 속성이_없거나_레이팅_제외이거나_기준_난이도가_없는_행은_방어적으로_제외한다() {
        settings(5, 5);
        tableExists();
        tiers(0);
        candidates(
                cand(1, 10, "레이팅 제외", "6.0", "95.00", false),
                cand(2, 11, (String) null, "6.0", "95.00", false),
                cand(3, 12, "단일", null, "95.00", false),
                cand(4, 13, "알수없음", "6.0", "95.00", false),
                cand(5, 14, "단일", "6.0", "95.00", false));

        SkillResponse response = service.mySkill(USER);

        assertThat(response.single()).extracting(SkillEntryResponse::songDifficultyId).containsExactly(5L);
        assertThat(response.other()).isEmpty();
    }

    @Test
    void 레이팅_서열표가_없으면_빈_목록이고_후보_조회도_하지_않는다() {
        settings(15, 25);
        tiers(0, 500);
        when(tableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(any(), any())).thenReturn(Optional.empty());

        SkillResponse response = service.mySkill(USER);

        assertThat(response.single()).isEmpty();
        assertThat(response.other()).isEmpty();
        assertThat(response.totalScore()).isEqualByComparingTo("0");
        assertThat(response.tier().minScore()).isZero();
        verify(skillMapper, never()).findRatingCandidates(any(), any(), any(), any());
    }

    @Test
    void 쿼리에는_토큰의_사용자와_설정의_노트_옵션_표_id를_넘긴다() {
        settings(15, 25);
        tableExists();
        tiers(0);
        candidates();

        service.mySkill(USER);

        verify(skillMapper).findRatingCandidates(USER, "SUPER_RANDOM_PLUS", TABLE_ID, "레이팅 제외");
    }

    @Test
    void 플레이어_티어는_합계의_정수부가_구간_시작_이상인_가장_높은_구간이다() {
        settings(5, 5);
        tableExists();
        tiers(0, 304, 305);

        // 점수 304.00 -> 정수부 304 -> 시작 304 이상이므로 Tier304, 다음은 Tier305
        candidates(cand(1, 10, PatternType.SINGLE, "6.0", "95.00"));
        SkillResponse exact = service.mySkill(USER);
        assertThat(exact.tier().minScore()).isEqualTo(304);
        assertThat(exact.tier().nextMinScore()).isEqualTo(305);

        // 달성률 94.99 -> V = 12 + 3.2 x 14.99/15 = 15.19786... -> x20 = 303.957 -> 303.96 -> 정수부 303 -> 시작 0 구간
        candidates(cand(1, 10, PatternType.SINGLE, "6.0", "94.99"));
        SkillResponse below = service.mySkill(USER);
        assertThat(below.totalScore()).isEqualByComparingTo("303.96");
        assertThat(below.tier().minScore()).isZero();
        assertThat(below.tier().nextMinScore()).isEqualTo(304);
    }

    @Test
    void 가장_높은_구간이면_다음_티어는_null이다() {
        settings(5, 5);
        tableExists();
        tiers(0, 100);
        candidates(cand(1, 10, PatternType.SINGLE, "6.0", "95.00"));   // 304.00 > 100

        SkillResponse.PlayerTierResponse tier = service.mySkill(USER).tier();

        assertThat(tier.minScore()).isEqualTo(100);
        assertThat(tier.nextDisplayName()).isNull();
        assertThat(tier.nextMinScore()).isNull();
    }

    @Test
    void 구간표가_비어_있으면_티어는_null이다() {
        settings(5, 5);
        tableExists();
        tiers();
        candidates();

        assertThat(service.mySkill(USER).tier()).isNull();
    }

    @Test
    void 레이팅_설정이_빠져_있으면_예외로_알린다() {
        when(settingRepository.findAll()).thenReturn(List.of(AppSetting.create("rating.pivot", "6.0", null)));

        assertThatThrownBy(() -> service.mySkill(USER)).isInstanceOf(IllegalStateException.class);
    }

    // ---- 마지막 달성 시각 (유저 목록 동점 처리, D26)

    @Test
    void 마지막_달성_시각은_레이팅_목록에_들어간_채보들의_달성_시각_중_가장_늦은_것이다() {
        settings(1, 1);
        tableExists();
        tiers(0);
        candidates(
                cand(1, 10, PatternType.SINGLE.getLabel(), "7.0", "80.00", false, LocalDateTime.of(2026, 10, 1, 0, 0)),   // 단일 1위 (목록 안)
                cand(2, 11, PatternType.COMPOUND.getLabel(), "7.0", "80.00", false, LocalDateTime.of(2026, 10, 3, 0, 0)), // 그 외 1위 (목록 안)
                // 탈락한 채보(점수가 낮아 목록에 못 들어감)의 시각은 아무리 늦어도 쓰지 않는다
                cand(3, 12, PatternType.SINGLE.getLabel(), "5.0", "50.00", false, LocalDateTime.of(2026, 12, 25, 0, 0)));

        SkillService.RatedSkill rated = service.rated(USER);

        assertThat(rated.lastAchievedAt()).isEqualTo(LocalDateTime.of(2026, 10, 3, 0, 0));
        assertThat(rated.skill().single()).hasSize(1);
        assertThat(rated.skill().other()).hasSize(1);
    }

    @Test
    void 달성_시각이_없거나_목록이_비면_마지막_달성_시각은_null이다() {
        settings(1, 1);
        tableExists();
        tiers(0);
        candidates();

        assertThat(service.rated(USER).lastAchievedAt()).isNull();

        candidates(cand(1, 10, PatternType.SINGLE, "7.0", "80.00"));   // 시각 값이 비어 있는 후보
        assertThat(service.rated(USER).lastAchievedAt()).isNull();
    }

    @Test
    void mySkill은_rated의_레이팅_부분과_같다() {
        settings(1, 1);
        tableExists();
        tiers(0);
        candidates(cand(1, 10, PatternType.SINGLE, "7.0", "80.00"));

        assertThat(service.mySkill(USER).totalScore()).isEqualByComparingTo(service.rated(USER).skill().totalScore());
    }
}
