package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.DashboardResponse.Dashboard;
import com.srpfreaks.backend.dto.DashboardResponse.RecordPoint;
import com.srpfreaks.backend.dto.DashboardResponse.SignupPoint;
import com.srpfreaks.backend.dto.DashboardResponse.TierRow;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.SuggestionStatus;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.DashboardMapper;
import com.srpfreaks.backend.mapper.DayCountRow;
import com.srpfreaks.backend.mapper.StatusCountRow;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 관리자 대시보드(D80) 서비스. DB 없이 mapper를 가짜로 두고 권한 · 기간 화이트리스트 · 한국 시간 날짜 경계 · 합계 계산 · 쿼리 횟수를 확인한다.
 * 집계 쿼리 자체(한국 시간 하루 묶기, 개수)는 DashboardMapperTest(Testcontainers)가 실제 MySQL에서 확인한다.
 * 숫자는 모두 손으로 계산한 값이다.
 */
@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    static final long ROOT = 1L;
    static final String SRN_PLUS = NoteOption.SUPER_RANDOM_PLUS.name();

    @Mock UserRepository userRepository;
    @Mock DashboardMapper dashboardMapper;
    @Mock SkillService skillService;

    DashboardService service;

    @BeforeEach
    void setUp() {
        // 2026-11-14 15:30 UTC = 2026-11-15 00:30 KST (UTC 날짜는 14일이지만 한국 날짜는 15일: 경계 시각)
        service = serviceAt("2026-11-14T15:30:00Z");
        user(ROOT, Role.ROOT, true);
        lenient().when(skillService.ratingConfig()).thenReturn(config());
    }

    // ---- 준비용 도우미

    private DashboardService serviceAt(String instant) {
        return new DashboardService(userRepository, dashboardMapper, skillService, Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
    }

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

    private static DayCountRow day(String date, long count) {
        return new DayCountRow(LocalDate.parse(date), count);
    }

    private static SkillService.RatedSkill rated(String tierKey, int minScore) {
        PlayerTierResponse tier = tierKey == null ? null : new PlayerTierResponse(tierKey, tierKey.toUpperCase(), minScore, null, null);
        SkillResponse skill = new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, tier, 15, 25,
                List.of(), List.of());
        return new SkillService.RatedSkill(skill, null);
    }

    // ---- 권한 (서비스에서 한 번 더 확인)

    @Test
    void ROOT가_아니면_403이고_아무것도_읽지_않는다() {
        user(2L, Role.USER, true);
        user(3L, Role.ADMIN, true);
        user(4L, Role.ROOT, false);   // 차단된 ROOT(토큰이 남아 있는 경우)

        for (Long actor : new Long[]{2L, 3L, 4L, 99L, null}) {
            assertThatThrownBy(() -> service.dashboard(actor, "7"))
                    .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.FORBIDDEN);
        }
        verifyNoInteractions(dashboardMapper, skillService);
    }

    // ---- 기간 화이트리스트

    @Test
    void 허용_밖의_기간은_400이고_아무것도_읽지_않는다() {
        for (String days : new String[]{"0", "1", "14", "31", "100", "abc", "-7", "7.0", "07", "7d", "7,30"}) {
            assertThatThrownBy(() -> service.dashboard(ROOT, days))
                    .as("days=" + days)
                    .isInstanceOf(ApiException.class).extracting("errorCode").isEqualTo(ErrorCode.VALIDATION_ERROR);
        }
        verifyNoInteractions(dashboardMapper, skillService);
    }

    @Test
    void 기간을_주지_않으면_7일이고_7_30_90은_통과한다() {
        assertThat(service.dashboard(ROOT, null).days()).isEqualTo(7);
        assertThat(service.dashboard(ROOT, "  ").days()).isEqualTo(7);
        assertThat(service.dashboard(ROOT, "7").days()).isEqualTo(7);
        Dashboard thirty = service.dashboard(ROOT, "30");
        Dashboard ninety = service.dashboard(ROOT, "90");

        assertThat(thirty.days()).isEqualTo(30);
        assertThat(thirty.from()).isEqualTo(LocalDate.parse("2026-10-17"));   // 15일 - 29일
        assertThat(thirty.signups()).hasSize(30);
        assertThat(ninety.days()).isEqualTo(90);
        assertThat(ninety.from()).isEqualTo(LocalDate.parse("2026-08-18"));   // 15일 - 89일
        assertThat(ninety.records()).hasSize(90);
    }

    // ---- 한국 시간 날짜 경계

    @Test
    void 한국_시간으로_오늘을_정하고_그_하루들의_0시를_UTC로_바꿔_mapper에_넘긴다() {
        // 지금 = 2026-11-15 00:30 KST. 7일 = 11/9 ~ 11/15. 시작 = 11/9 00:00 KST = 11/8 15:00 UTC, 끝(포함 안 함) = 11/16 00:00 KST = 11/15 15:00 UTC
        Dashboard result = service.dashboard(ROOT, "7");

        assertThat(result.zone()).isEqualTo("Asia/Seoul");
        assertThat(result.to()).isEqualTo(LocalDate.parse("2026-11-15"));
        assertThat(result.from()).isEqualTo(LocalDate.parse("2026-11-09"));

        ArgumentCaptor<LocalDateTime> since = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> until = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<Integer> offset = ArgumentCaptor.forClass(Integer.class);
        verify(dashboardMapper).countRecordsByDay(since.capture(), until.capture(), offset.capture());
        assertThat(since.getValue()).isEqualTo(LocalDateTime.parse("2026-11-08T15:00:00"));
        assertThat(until.getValue()).isEqualTo(LocalDateTime.parse("2026-11-15T15:00:00"));
        assertThat(offset.getValue()).isEqualTo(9 * 3600);
    }

    @Test
    void 한국_시간_23시59분은_아직_그날이고_UTC_날짜가_같아도_다음날_0시는_다음날이다() {
        // 2026-11-14 14:59:59 UTC = 11/14 23:59:59 KST -> 오늘은 14일
        Dashboard before = serviceAt("2026-11-14T14:59:59Z").dashboard(ROOT, "7");
        // 2026-11-14 15:00:00 UTC = 11/15 00:00:00 KST -> 오늘은 15일
        Dashboard after = serviceAt("2026-11-14T15:00:00Z").dashboard(ROOT, "7");

        assertThat(before.to()).isEqualTo(LocalDate.parse("2026-11-14"));
        assertThat(after.to()).isEqualTo(LocalDate.parse("2026-11-15"));
    }

    // ---- 합계·추이 계산 (손으로 계산한 값)

    @Test
    void 요약과_가입자_누적_기록_수를_계산한다() {
        // 전체 가입자 50명, 이 기간(11/9~11/15)에 11/9 2명 + 11/12 1명 + 11/15 3명 = 6명 늘었다 -> 기간 앞 가입자 44명
        when(dashboardMapper.countUsers()).thenReturn(50L);
        when(dashboardMapper.countPublicProfiles()).thenReturn(20L);
        when(dashboardMapper.countSignupsByDay(any(), any(), anyInt()))
                .thenReturn(List.of(day("2026-11-09", 2), day("2026-11-12", 1), day("2026-11-15", 3)));
        when(dashboardMapper.countRecordsByDay(any(), any(), anyInt()))
                .thenReturn(List.of(day("2026-11-14", 4), day("2026-11-15", 7), day("2026-11-10", 1)));
        when(dashboardMapper.countSuggestionsByStatus())
                .thenReturn(List.of(new StatusCountRow("RECEIVED", 3), new StatusCountRow("DONE", 5)));

        Dashboard result = service.dashboard(ROOT, "7");

        assertThat(result.summary().totalUsers()).isEqualTo(50);
        assertThat(result.summary().newUsers()).isEqualTo(6);
        assertThat(result.summary().publicProfiles()).isEqualTo(20);
        assertThat(result.summary().publicRatioPercent()).isEqualByComparingTo("40.0");   // 20 / 50 = 40.0%
        assertThat(result.summary().recordsToday()).isEqualTo(7);                         // 한국 시간 11/15
        assertThat(result.summary().recordsYesterday()).isEqualTo(4);                     // 한국 시간 11/14
        assertThat(result.summary().pendingSuggestions()).isEqualTo(3);

        // 날짜별 누적: 44 -> 11/9 +2 = 46, 11/10~11 그대로 46, 11/12 +1 = 47, 11/13~14 그대로 47, 11/15 +3 = 50
        assertThat(result.signups()).extracting(SignupPoint::date).containsExactly(
                LocalDate.parse("2026-11-09"), LocalDate.parse("2026-11-10"), LocalDate.parse("2026-11-11"), LocalDate.parse("2026-11-12"),
                LocalDate.parse("2026-11-13"), LocalDate.parse("2026-11-14"), LocalDate.parse("2026-11-15"));
        assertThat(result.signups()).extracting(SignupPoint::newUsers).containsExactly(2L, 0L, 0L, 1L, 0L, 0L, 3L);
        assertThat(result.signups()).extracting(SignupPoint::totalUsers).containsExactly(46L, 46L, 46L, 47L, 47L, 47L, 50L);
        // 기록: 없는 날은 0으로 채운다
        assertThat(result.records()).extracting(RecordPoint::records).containsExactly(0L, 1L, 0L, 0L, 0L, 4L, 7L);
    }

    @Test
    void 비율은_소수_첫째_자리로_반올림하고_가입자가_없으면_null이다() {
        when(dashboardMapper.countUsers()).thenReturn(3L);
        when(dashboardMapper.countPublicProfiles()).thenReturn(1L);   // 1 / 3 = 33.33...%
        assertThat(service.dashboard(ROOT, "7").summary().publicRatioPercent()).isEqualByComparingTo("33.3");

        when(dashboardMapper.countUsers()).thenReturn(0L);
        when(dashboardMapper.countPublicProfiles()).thenReturn(0L);
        assertThat(service.dashboard(ROOT, "7").summary().publicRatioPercent()).isNull();
    }

    @Test
    void 건의는_네_상태를_모두_내리고_없는_상태는_0이다() {
        when(dashboardMapper.countSuggestionsByStatus())
                .thenReturn(List.of(new StatusCountRow("REJECTED", 2), new StatusCountRow("RECEIVED", 3), new StatusCountRow("UNKNOWN", 9)));

        Dashboard result = service.dashboard(ROOT, "7");

        assertThat(result.suggestions()).extracting(s -> s.status()).containsExactly(
                SuggestionStatus.RECEIVED, SuggestionStatus.REVIEWING, SuggestionStatus.DONE, SuggestionStatus.REJECTED);
        assertThat(result.suggestions()).extracting(s -> s.count()).containsExactly(3L, 0L, 0L, 2L);   // 모르는 상태 UNKNOWN은 세지 않는다
        assertThat(result.summary().pendingSuggestions()).isEqualTo(3);
    }

    // ---- 티어 분포 (공개 프로필 유저만, 한 번에)

    @Test
    void 티어_분포는_공개_유저의_티어별_인원수만_낮은_티어부터_내린다() {
        when(dashboardMapper.countRecordedUsers(SRN_PLUS)).thenReturn(9L);   // 기록이 있는 전체(비공개 포함) 9명
        when(dashboardMapper.findTierUserIds(SRN_PLUS)).thenReturn(List.of(11L, 12L, 13L, 14L));
        Map<Long, SkillService.RatedSkill> rated = new LinkedHashMap<>();
        rated.put(11L, rated("gold", 1000));
        rated.put(12L, rated("gold", 1000));
        rated.put(13L, rated("silver", 500));
        rated.put(14L, rated(null, 0));   // 티어를 정할 수 없는 경우는 분포에 넣지 않는다
        when(skillService.ratedBatch(anyCollection())).thenReturn(rated);

        Dashboard result = service.dashboard(ROOT, "7");

        assertThat(result.tiers().basis()).isEqualTo("PUBLIC_PROFILES");
        assertThat(result.tiers().recordedUsers()).isEqualTo(9);
        assertThat(result.tiers().countedUsers()).isEqualTo(4);
        assertThat(result.tiers().rows()).extracting(TierRow::key).containsExactly("silver", "gold");     // 낮은 티어부터
        assertThat(result.tiers().rows()).extracting(TierRow::users).containsExactly(1L, 2L);
    }

    // ---- 쿼리 횟수: 유저·기록이 아무리 많아도 같다

    @Test
    void 유저가_많아도_mapper는_한_번씩만_부르고_티어_계산은_후보_쿼리_한_번이다() {
        List<Long> ids = new ArrayList<>();
        Map<Long, SkillService.RatedSkill> rated = new LinkedHashMap<>();
        for (long i = 1; i <= 200; i++) {
            ids.add(i);
            rated.put(i, rated("gold", 1000));
        }
        when(dashboardMapper.findTierUserIds(SRN_PLUS)).thenReturn(ids);
        when(skillService.ratedBatch(anyCollection())).thenReturn(rated);

        Dashboard result = service.dashboard(ROOT, "90");

        verify(dashboardMapper, times(1)).countUsers();
        verify(dashboardMapper, times(1)).countPublicProfiles();
        verify(dashboardMapper, times(1)).countSignupsByDay(any(), any(), anyInt());
        verify(dashboardMapper, times(1)).countRecordsByDay(any(), any(), anyInt());
        verify(dashboardMapper, times(1)).countSuggestionsByStatus();
        verify(dashboardMapper, times(1)).countRecordedUsers(anyString());
        verify(dashboardMapper, times(1)).findTierUserIds(anyString());
        // 200명의 티어를 한 번에: ratedBatch는 id 전체로 딱 한 번 부르고, 유저마다 계산하는 ratedAll은 부르지 않는다
        ArgumentCaptor<java.util.Collection<Long>> captor = ArgumentCaptor.forClass(java.util.Collection.class);
        verify(skillService, times(1)).ratedBatch(captor.capture());
        assertThat(captor.getValue()).hasSize(200);
        verify(skillService, never()).ratedAll(anyCollection());
        assertThat(result.tiers().rows()).extracting(TierRow::users).containsExactly(200L);
    }
}
