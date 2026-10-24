package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SetlistRecommendationResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.RecommendCandidate;
import com.srpfreaks.backend.mapper.SetlistRecommendMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.entity.SetlistRecommendRange;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.SetlistRecommendRangeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SetlistRecommendServiceTest {

    static final BigDecimal BASE = new BigDecimal("6.20");

    @Mock AppSettingRepository appSettingRepository;
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock SetlistRecommendMapper mapper;
    @Mock PlayLevelEstimator estimator;
    @Mock SetlistRecommendRangeRepository rangeRepository;

    SetlistRecommendService service;
    DifficultyTable table;

    @BeforeEach
    void setUp() {
        service = new SetlistRecommendService(appSettingRepository, difficultyTableRepository, mapper, estimator, rangeRepository);
        when(rangeRepository.findByUserId(1L)).thenReturn(Optional.empty());
        table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        ReflectionTestUtils.setField(table, "id", 3L);
        when(appSettingRepository.findAll()).thenReturn(List.of(
                AppSetting.create("setlist.recommend_ss_min", "-0.6", null),
                AppSetting.create("setlist.recommend_ss_max", "-0.1", null),
                AppSetting.create("setlist.recommend_s_min", "-0.1", null),
                AppSetting.create("setlist.recommend_s_max", "0.4", null),
                AppSetting.create("setlist.recommend_min_single", "5", null),
                AppSetting.create("setlist.recommend_min_other", "9", null),
                AppSetting.create("setlist.recommend_starter_tier", "5.2", null)));
    }

    private void givenTable() {
        when(difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE))
                .thenReturn(Optional.of(table));
    }

    /** 평균 난이도가 6.20인 사용자로 맞추고, 쿼리가 돌려줄 후보를 정한다. */
    private void givenCandidates(RecommendCandidate... candidates) {
        givenTable();
        when(estimator.estimate(1L)).thenReturn(PlayLevelEstimate.ready(BASE, 15, 25));
        when(mapper.findCandidates(eq(1L), eq("SUPER_RANDOM_PLUS"), eq(3L), eq(PatternType.EXCLUDED.getLabel()), any(), any()))
                .thenReturn(List.of(candidates));
    }

    /** rate가 null이면 기록 없는 채보. */
    private static RecommendCandidate cand(long id, String tier, String rate, boolean fc) {
        return new RecommendCandidate(id, 100L + id, "곡" + id, "GUITAR", "MASTER", new BigDecimal("9.50"),
                new BigDecimal(tier), "단일", rate == null ? null : new BigDecimal(rate), rate == null ? null : fc);
    }

    private static List<Long> ids(List<SetlistRecommendationResponse.Item> items) {
        return items.stream().map(SetlistRecommendationResponse.Item::songDifficultyId).toList();
    }

    @Test
    void 쿼리는_두_범위를_합친_구간으로_한_번만_조회한다() {
        givenCandidates();

        service.recommend(1L, 0, 0, 5);

        ArgumentCaptor<BigDecimal> lo = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<BigDecimal> hi = ArgumentCaptor.forClass(BigDecimal.class);
        verify(mapper).findCandidates(eq(1L), anyString(), eq(3L), anyString(), lo.capture(), hi.capture());
        assertThat(lo.getValue()).isEqualByComparingTo("5.60");   // 6.20 + min(-0.6, -0.1)
        assertThat(hi.getValue()).isEqualByComparingTo("6.60");   // 6.20 + max(-0.1, 0.4)
    }

    @Test
    void 후보의_속성_글자를_추천_줄에_그대로_내려준다() {
        // 평균 6.20 기준 SS 기준 범위(5.60 ~ 6.10) 안, 기록 없는 채보 하나
        givenCandidates(cand(1, "5.80", null, false));

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.ssChallenge()).extracting(SetlistRecommendationResponse.Item::pattern).containsOnly("단일");
    }

    @Test
    void 기본_범위를_쓰면_customRange가_false이고_서버_기본_범위를_내려준다() {
        givenCandidates();

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.customRange()).isFalse();
        assertThat(r.ssMin()).isEqualByComparingTo("-0.6");
        assertThat(r.ssMax()).isEqualByComparingTo("-0.1");
        assertThat(r.sMin()).isEqualByComparingTo("-0.1");
        assertThat(r.sMax()).isEqualByComparingTo("0.4");
    }

    @Test
    void 사용자가_정한_범위가_있으면_기본_범위_대신_쓰고_조회_구간도_그에_맞춘다() {
        User user = User.create("sub-1", "a@example.com", "tester");
        // SS 기준 -1.0 ~ -0.5, S 기준 0.0 ~ 1.0 (평균 6.20 -> SS 5.20~5.70, S 6.20~7.20)
        when(rangeRepository.findByUserId(1L)).thenReturn(Optional.of(SetlistRecommendRange.create(user,
                new BigDecimal("-1.00"), new BigDecimal("-0.50"), new BigDecimal("0.00"), new BigDecimal("1.00"))));
        givenCandidates(
                cand(1, "5.20", null, false),     // SS 기준 하한 경계 -> 포함
                cand(2, "5.70", null, false),     // SS 기준 상한 경계 -> 포함
                cand(3, "6.10", null, false),     // 기본 범위였다면 SS 기준이지만 지금은 어느 범위에도 없다 -> 제외
                cand(4, "7.20", null, false),     // S 기준 상한 경계 -> 포함
                cand(5, "6.20", "70.00", false)); // S 기준 하한 경계 -> 포함

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 10);

        assertThat(r.customRange()).isTrue();
        assertThat(r.ssMin()).isEqualByComparingTo("-1.00");
        assertThat(ids(r.ssChallenge())).containsExactlyInAnyOrder(1L, 2L);
        assertThat(ids(r.sFill())).containsExactlyInAnyOrder(4L, 5L);
        ArgumentCaptor<BigDecimal> lo = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<BigDecimal> hi = ArgumentCaptor.forClass(BigDecimal.class);
        verify(mapper).findCandidates(eq(1L), anyString(), eq(3L), anyString(), lo.capture(), hi.capture());
        assertThat(lo.getValue()).isEqualByComparingTo("5.20");   // 6.20 + min(-1.0, 0.0)
        assertThat(hi.getValue()).isEqualByComparingTo("7.20");   // 6.20 + max(-0.5, 1.0)
    }

    @Test
    void SS_기준은_평균보다_쉬운_쪽_5점6_6점1_안의_기록_없음_또는_SS_미만이다_경계_포함() {
        givenCandidates(
                cand(1, "6.10", null, false),     // 평균 - 0.10 (상한 경계) 기록 없음 -> 포함
                cand(2, "5.60", "90.00", false),  // 평균 - 0.60 (하한 경계) S -> 포함
                cand(3, "6.00", "95.00", false),  // SS -> 제외
                cand(4, "6.00", "80.00", true),   // FC(달성률은 낮아도 단계는 FC) -> SS 이상이라 제외
                cand(5, "6.00", "100.00", true)); // EXC -> 제외

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.status()).isEqualTo(SetlistRecommendationResponse.Status.READY);
        assertThat(r.baseTier()).isEqualByComparingTo("6.20");
        assertThat(ids(r.ssChallenge())).containsExactlyInAnyOrder(1L, 2L);
        assertThat(r.sFill()).isEmpty();   // SS 이상 기록은 S 기준에도 없다
    }

    @Test
    void S_기준은_평균_근처에서_위쪽_6점1_6점6_안의_기록_없음_또는_S_미만이고_SS_기준과_겹치지_않는다() {
        givenCandidates(
                cand(1, "6.60", null, false),     // 평균 + 0.40 (상한 경계), 기록 없음 -> S 기준
                cand(2, "6.30", "70.00", false),  // 평균 + 0.10, A -> S 기준
                cand(3, "6.50", "85.00", false),  // S -> S 이상이라 제외
                cand(4, "6.10", "70.00", false),  // SS 기준 상한 경계(두 범위가 겹치는 곳) -> SS 기준에만
                cand(5, "6.40", "95.00", false)); // SS -> 제외

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(ids(r.ssChallenge())).containsExactly(4L);
        assertThat(ids(r.sFill())).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void 평균보다_어려운_곡은_SS_기준에_넣지_않는다() {
        givenCandidates(cand(1, "6.30", null, false), cand(2, "6.60", null, false));

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.ssChallenge()).isEmpty();
        assertThat(ids(r.sFill())).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void 범위_밖_후보는_쿼리가_돌려줘도_걸러낸다() {
        givenCandidates(cand(1, "6.70", null, false), cand(2, "5.50", null, false));

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.ssChallenge()).isEmpty();
        assertThat(r.sFill()).isEmpty();
    }

    @Test
    void 평균에_가까운_순이_먼저_같으면_기록_없음_달성률_낮은_순_id_순() {
        givenCandidates(
                cand(10, "6.10", "90.00", false),
                cand(11, "6.10", "70.00", false),
                cand(12, "5.60", null, false),
                cand(13, "6.10", null, false),    // 차이 0.1 안에서는 기록 없음이 먼저
                cand(14, "6.10", "70.00", false), // 같은 차이·같은 달성률이면 id 순
                cand(15, "5.90", "70.00", false));// 차이 0.3: 가까운 묶음 뒤

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 10);

        assertThat(ids(r.ssChallenge())).containsExactly(13L, 11L, 14L, 10L, 15L, 12L);
    }

    @Test
    void 기록이_있으면_내_최고_기록과_단계를_함께_내려준다() {
        givenCandidates(cand(1, "6.10", "85.50", false), cand(2, "6.10", null, false));

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.ssChallenge().get(0).mine()).isNull();   // 차이가 같으면 기록 없는 채보가 먼저
        assertThat(r.ssChallenge().get(1).mine().rate()).isEqualByComparingTo("85.50");
        assertThat(r.ssChallenge().get(1).mine().stage()).isEqualTo(AchievementStage.S);
        assertThat(r.ssChallenge().get(1).title()).isEqualTo("곡1");
    }

    @Test
    void 두_묶음을_size개씩_자르고_묶음마다_전체_페이지를_센다() {
        givenCandidates(
                cand(1, "6.10", null, false), cand(2, "6.10", null, false), cand(3, "6.10", null, false),
                cand(4, "6.10", null, false), cand(5, "6.10", null, false),     // SS 기준 5개
                cand(6, "6.50", null, false));                                  // S 기준 1개

        SetlistRecommendationResponse first = service.recommend(1L, 0, 0, 2);

        assertThat(first.size()).isEqualTo(2);
        assertThat(first.ssTotalPages()).isEqualTo(3);   // SS 기준 5개 / 2개씩 = 3쪽
        assertThat(first.sTotalPages()).isEqualTo(1);    // S 기준 1개 = 1쪽
        assertThat(ids(first.ssChallenge())).containsExactly(1L, 2L);
        assertThat(ids(first.sFill())).containsExactly(6L);
    }

    @Test
    void 두_묶음은_각자_자기_쪽을_넘긴다() {
        givenCandidates(
                cand(1, "6.10", null, false), cand(2, "6.10", null, false), cand(3, "6.10", null, false),   // SS 기준 3개
                cand(6, "6.50", null, false), cand(7, "6.50", null, false), cand(8, "6.50", null, false));  // S 기준 3개

        // SS 기준은 2쪽(index 1), S 기준은 1쪽(index 0)
        SetlistRecommendationResponse r = service.recommend(1L, 1, 0, 2);

        assertThat(r.ssPage()).isEqualTo(1);
        assertThat(r.sPage()).isZero();
        assertThat(ids(r.ssChallenge())).containsExactly(3L);
        assertThat(ids(r.sFill())).containsExactly(6L, 7L);
        assertThat(r.ssTotalPages()).isEqualTo(2);
        assertThat(r.sTotalPages()).isEqualTo(2);
    }

    @Test
    void 뒤쪽_페이지와_범위를_넘은_페이지를_처리한다() {
        givenCandidates(
                cand(1, "6.10", null, false), cand(2, "6.10", null, false), cand(3, "6.10", null, false),
                cand(6, "6.50", null, false));

        assertThat(ids(service.recommend(1L, 1, 1, 2).ssChallenge())).containsExactly(3L);
        assertThat(service.recommend(1L, 1, 1, 2).sFill()).isEmpty();            // S 기준은 1쪽에 없다
        assertThat(service.recommend(1L, 99, 99, 2).ssChallenge()).isEmpty();     // 범위를 넘으면 빈 목록(오류 아님)
    }

    @Test
    void 잘못된_page와_size는_허용_범위로_맞춘다() {
        givenCandidates();

        SetlistRecommendationResponse r = service.recommend(1L, -3, -3, 99);

        assertThat(r.ssPage()).isZero();
        assertThat(r.sPage()).isZero();
        assertThat(r.size()).isEqualTo(SetlistRecommendService.MAX_PAGE_SIZE);
        assertThat(service.recommend(1L, 0, 0, 0).size()).isEqualTo(1);
    }

    @Test
    void 단일_또는_그_외가_모자라면_추천하지_않고_개수만_알려_주며_쿼리도_하지_않는다() {
        givenTable();
        when(estimator.estimate(1L)).thenReturn(PlayLevelEstimate.insufficient(3, 8));

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.status()).isEqualTo(SetlistRecommendationResponse.Status.INSUFFICIENT);
        assertThat(r.baseTier()).isNull();
        assertThat(r.ssChallenge()).isEmpty();
        assertThat(r.sFill()).isEmpty();
        assertThat(r.ratedSingle()).isEqualTo(3);
        assertThat(r.ratedOther()).isEqualTo(8);
        assertThat(r.requiredSingle()).isEqualTo(5);
        assertThat(r.requiredOther()).isEqualTo(9);
        assertThat(r.ssTotalPages()).isZero();
        assertThat(r.sTotalPages()).isZero();
        verify(mapper, never()).findCandidates(anyLong(), anyString(), anyLong(), anyString(), any(), any());
    }

    @Test
    void 신규_사용자는_입문_난이도_이하의_S_미만_채보만_S_기준으로_받는다() {
        givenTable();
        when(estimator.estimate(1L)).thenReturn(PlayLevelEstimate.newPlayer());
        when(mapper.findCandidates(eq(1L), eq("SUPER_RANDOM_PLUS"), eq(3L), eq(PatternType.EXCLUDED.getLabel()), any(), any()))
                .thenReturn(List.of(
                        cand(1, "5.20", null, false),     // 상한 경계, 기록 없음 -> 포함
                        cand(2, "5.00", "85.00", false),  // S -> 제외
                        cand(3, "4.80", "70.00", false),  // A -> 포함
                        cand(4, "5.30", null, false)));   // 상한 밖 -> 걸러낸다

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.status()).isEqualTo(SetlistRecommendationResponse.Status.STARTER);
        assertThat(r.baseTier()).isEqualByComparingTo("5.2");
        assertThat(r.ssChallenge()).isEmpty();                   // SS 기준은 보여 주지 않는다
        assertThat(ids(r.sFill())).containsExactly(1L, 3L);      // 5.2에 가까운 순
        ArgumentCaptor<BigDecimal> hi = ArgumentCaptor.forClass(BigDecimal.class);
        verify(mapper).findCandidates(eq(1L), anyString(), eq(3L), anyString(), any(), hi.capture());
        assertThat(hi.getValue()).isEqualByComparingTo("5.2");
    }

    @Test
    void 레이팅_서열표가_없으면_추정도_쿼리도_하지_않는다() {
        when(difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE))
                .thenReturn(Optional.empty());

        SetlistRecommendationResponse r = service.recommend(1L, 0, 0, 5);

        assertThat(r.status()).isEqualTo(SetlistRecommendationResponse.Status.UNAVAILABLE);
        assertThat(r.baseTier()).isNull();
        verifyNoInteractions(estimator, mapper);
    }
}
