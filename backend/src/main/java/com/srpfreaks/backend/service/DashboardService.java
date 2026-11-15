package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.DashboardResponse.Dashboard;
import com.srpfreaks.backend.dto.DashboardResponse.RecordPoint;
import com.srpfreaks.backend.dto.DashboardResponse.SignupPoint;
import com.srpfreaks.backend.dto.DashboardResponse.Summary;
import com.srpfreaks.backend.dto.DashboardResponse.SuggestionStatusCount;
import com.srpfreaks.backend.dto.DashboardResponse.TierDistribution;
import com.srpfreaks.backend.dto.DashboardResponse.TierRow;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.SuggestionStatus;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.DashboardMapper;
import com.srpfreaks.backend.mapper.DayCountRow;
import com.srpfreaks.backend.mapper.StatusCountRow;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * 관리자 대시보드(D80): 가입자·기록·티어·건의 현황을 숫자로만 보여 주는 ROOT 전용 읽기 서비스다. 아무것도 저장하지 않는다(감사 로그도 쓰지 않는다).
 *
 * 개인정보: 응답에는 합계와 날짜별 개수, 티어별 인원수만 있다. 이메일·닉네임·개인 기록은 읽어도 내보내지 않는다.
 * 티어 분포는 공개 프로필 유저만 계산한다(비공개 유저의 기록은 읽지 않는다, D77과 같은 원칙). 그 사실을 응답의 basis·recordedUsers·countedUsers로 알린다.
 *
 * 권한: 컨트롤러의 @PreAuthorize("hasRole('ROOT')")와 주소 규칙(/api/v1/admin/dashboard)에 더해 여기서도 한 번 더 확인한다
 * (토큰의 역할이 아니라 DB의 현재 역할·상태). 강등되거나 차단된 계정은 토큰이 남아 있어도 읽을 수 없다.
 *
 * 한국 시간 하루: 시각은 UTC로 저장돼 있다. 기간은 Asia/Seoul 달력으로 "오늘 포함 days일"이고, 그 시작·끝의 0시를 UTC 시각으로 바꿔
 * mapper에 넘긴다. mapper는 오프셋(32400초)을 더해 날짜별로 묶는다. 기록이 없는 날은 여기서 0으로 채운다.
 *
 * 쿼리 수: 유저 수·기록 수와 상관없이 일정하다(mapper 호출 7번 + 티어 계산 ratedBatch 한 번). 유저마다 계산하는 N+1이 없다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    /** 허용하는 기간(일) 값(화이트리스트). 이 밖의 값은 400이다. */
    public static final Set<String> ALLOWED_DAYS = Set.of("7", "30", "90");
    public static final String DEFAULT_DAYS = "7";
    public static final String TIER_BASIS = "PUBLIC_PROFILES";
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final UserRepository userRepository;
    private final DashboardMapper dashboardMapper;
    private final SkillService skillService;
    private final Clock clock;

    public Dashboard dashboard(Long actorId, String rawDays) {
        requireRoot(actorId);
        int days = parseDays(rawDays);

        LocalDate today = LocalDate.now(clock.withZone(SEOUL));
        LocalDate from = today.minusDays(days - 1L);
        ZonedDateTime fromStart = from.atStartOfDay(SEOUL);
        ZonedDateTime untilStart = today.plusDays(1).atStartOfDay(SEOUL);   // 내일 0시(포함하지 않는 끝)
        LocalDateTime since = fromStart.withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        LocalDateTime until = untilStart.withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        int offsetSeconds = fromStart.getOffset().getTotalSeconds();

        long totalUsers = dashboardMapper.countUsers();
        long publicProfiles = dashboardMapper.countPublicProfiles();
        Map<LocalDate, Long> signupsByDay = toMap(dashboardMapper.countSignupsByDay(since, until, offsetSeconds));
        Map<LocalDate, Long> recordsByDay = toMap(dashboardMapper.countRecordsByDay(since, until, offsetSeconds));
        Map<SuggestionStatus, Long> suggestionCounts = suggestionCounts(dashboardMapper.countSuggestionsByStatus());

        // 가입자 추이: 기간 안의 모든 날(없는 날은 0)에 그날 끝까지의 누적을 붙인다. 기간 앞의 가입자 수 = 전체 - 기간 안에 늘어난 수.
        long newUsers = signupsByDay.values().stream().mapToLong(Long::longValue).sum();
        long running = totalUsers - newUsers;
        List<SignupPoint> signups = new ArrayList<>();
        List<RecordPoint> records = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            long added = signupsByDay.getOrDefault(day, 0L);
            running += added;
            signups.add(new SignupPoint(day, added, running));
            records.add(new RecordPoint(day, recordsByDay.getOrDefault(day, 0L)));
        }

        Summary summary = new Summary(totalUsers, newUsers, publicProfiles, ratio(publicProfiles, totalUsers),
                recordsByDay.getOrDefault(today, 0L), recordsByDay.getOrDefault(today.minusDays(1), 0L),
                suggestionCounts.get(SuggestionStatus.RECEIVED));
        List<SuggestionStatusCount> suggestions = new ArrayList<>();
        for (SuggestionStatus status : SuggestionStatus.values()) {
            suggestions.add(new SuggestionStatusCount(status, suggestionCounts.get(status)));
        }
        return new Dashboard(days, SEOUL.getId(), from, today, summary, List.copyOf(signups), List.copyOf(records), tiers(),
                List.copyOf(suggestions));
    }

    // ---- 내부 ------------------------------------------------------------------------------------

    /** 플레이어 티어 분포: 기록이 있는 공개 프로필 유저의 티어를 후보 쿼리 한 번(ratedBatch)으로 구해 티어별 인원만 센다. */
    private TierDistribution tiers() {
        // 기록 옵션은 레이팅과 같은 설정(SRN+, D25)을 쓴다. 한 곳에서만 정한다.
        String noteOption = skillService.ratingConfig().noteOption().name();
        long recordedUsers = dashboardMapper.countRecordedUsers(noteOption);
        List<Long> userIds = dashboardMapper.findTierUserIds(noteOption);
        Map<Long, SkillService.RatedSkill> rated = skillService.ratedBatch(userIds);

        Map<Integer, TierRow> byMinScore = new TreeMap<>();
        for (SkillService.RatedSkill skill : rated.values()) {
            PlayerTierResponse tier = skill == null || skill.skill() == null ? null : skill.skill().tier();
            if (tier == null) {
                continue;
            }
            byMinScore.merge(tier.minScore(), new TierRow(tier.key(), tier.displayName(), tier.minScore(), 1),
                    (a, b) -> new TierRow(a.key(), a.displayName(), a.minScore(), a.users() + 1));
        }
        List<TierRow> rows = byMinScore.values().stream().sorted(Comparator.comparingInt(TierRow::minScore)).toList();
        return new TierDistribution(TIER_BASIS, recordedUsers, userIds.size(), rows);
    }

    private static Map<LocalDate, Long> toMap(List<DayCountRow> rows) {
        Map<LocalDate, Long> map = new HashMap<>();
        for (DayCountRow row : rows) {
            map.merge(row.day(), row.count(), Long::sum);
        }
        return map;
    }

    /** 상태별 개수. DB에 없는 상태는 0으로 채운다. 알 수 없는 상태 이름이 있어도 무시한다(오류로 만들지 않는다). */
    private static Map<SuggestionStatus, Long> suggestionCounts(List<StatusCountRow> rows) {
        Map<SuggestionStatus, Long> counts = new ZeroDefaultMap();
        for (StatusCountRow row : rows) {
            try {
                counts.merge(SuggestionStatus.valueOf(row.status()), row.count(), Long::sum);
            } catch (IllegalArgumentException ignored) {
                // 모르는 상태는 세지 않는다
            }
        }
        return counts;
    }

    /** get()이 없는 키에 0을 돌려주는 EnumMap. */
    private static final class ZeroDefaultMap extends EnumMap<SuggestionStatus, Long> {
        ZeroDefaultMap() {
            super(SuggestionStatus.class);
        }

        @Override
        public Long get(Object key) {
            Long value = super.get(key);
            return value == null ? 0L : value;
        }
    }

    /** 비율(%)을 소수 첫째 자리로. 전체가 0이면 null. */
    static BigDecimal ratio(long part, long whole) {
        if (whole <= 0) {
            return null;
        }
        return BigDecimal.valueOf(part).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(whole), 1, RoundingMode.HALF_UP);
    }

    /** 기간(일) 값 검사. 비어 있으면 기본 7일, 허용 밖의 값(숫자가 아닌 글자 포함)은 400이다. */
    static int parseDays(String raw) {
        String key = raw == null || raw.isBlank() ? DEFAULT_DAYS : raw.strip();
        if (!ALLOWED_DAYS.contains(key)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        return Integer.parseInt(key);
    }

    /** DB의 현재 역할·상태로 ROOT인지 확인한다. 아니면 403. */
    private void requireRoot(Long actorId) {
        User actor = actorId == null ? null : userRepository.findById(actorId).orElse(null);
        if (actor == null || !actor.isActive() || actor.getRole() != Role.ROOT) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
    }
}
