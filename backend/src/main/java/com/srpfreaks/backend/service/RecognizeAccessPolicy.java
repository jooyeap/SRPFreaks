package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RecognizeStatusResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.RecognizeUsage;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.RecognizeUsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 사진 입력(D55)을 누가·지금 쓸 수 있는지 판단하는 **유일한 곳**. 인식 API와 상태 API가 모두 이것을 거친다.
 * 시험 기간(ROOT·ADMIN만)에서 모두에게 여는 것은 설정 recognize.min_role을 USER로 바꾸는 것만으로 끝나도록,
 * 역할 비교를 여기(RecognizeConfig.allows) 한 곳에만 두고 컨트롤러·화면에는 역할 조건을 두지 않는다.
 *
 * 판단 순서: 꺼짐(DISABLED) → 권한(ROLE) → 사용자 최근 7일 한도(WEEKLY_LIMIT) → 전체 오늘 한도(DAILY_LIMIT).
 * "오늘"은 서울 날짜 기준이다(저장은 UTC).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecognizeAccessPolicy {

    static final Duration WINDOW = Duration.ofDays(7);
    /** 사용 기록 보관 기간: 7일 한도 + 하루 여유. 처리방침의 "8일"과 같다. */
    static final Duration KEEP = Duration.ofDays(8);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final AppSettingRepository appSettingRepository;
    private final RecognizeUsageRepository usageRepository;
    private final Clock clock;

    public RecognizeStatusResponse status(Long userId, Role role) {
        RecognizeConfig config = config();
        if (!config.enabled()) {
            return new RecognizeStatusResponse(false, "DISABLED", 0, config.weeklyLimit(), null);
        }
        if (!config.allows(role)) {
            return new RecognizeStatusResponse(false, "ROLE", 0, config.weeklyLimit(), null);
        }
        Instant now = clock.instant();
        Instant since = now.minus(WINDOW);
        long used = usageRepository.countByUser_IdAndUsedAtAfter(userId, since);
        int remaining = (int) Math.max(0, config.weeklyLimit() - used);
        if (remaining == 0) {
            // 가장 오래된 사용이 7일 창 밖으로 나가는 순간 한 장이 돌아온다
            Instant refill = usageRepository.findFirstByUser_IdAndUsedAtAfterOrderByUsedAtAsc(userId, since)
                    .map(u -> u.getUsedAt().plus(WINDOW))
                    .orElse(null);
            return new RecognizeStatusResponse(false, "WEEKLY_LIMIT", 0, config.weeklyLimit(), refill);
        }
        LocalDate today = LocalDate.ofInstant(now, SEOUL);
        long usedToday = usageRepository.countByUsedAtGreaterThanEqual(today.atStartOfDay(SEOUL).toInstant());
        if (usedToday >= config.dailyTotalLimit()) {
            return new RecognizeStatusResponse(false, "DAILY_LIMIT", remaining, config.weeklyLimit(),
                    today.plusDays(1).atStartOfDay(SEOUL).toInstant());
        }
        return new RecognizeStatusResponse(true, null, remaining, config.weeklyLimit(), null);
    }

    /**
     * 한 장 쓴 것으로 기록한다(인식 API가 모델을 부르기 직전에 부른다. 실패해도 센다: 같은 사진 반복 요청을 막기 위해).
     * 8일 지난 기록은 이때 함께 지운다(따로 예약 작업을 두지 않는다).
     */
    @Transactional
    public void record(RecognizeUsage usage) {
        usageRepository.deleteOlderThan(clock.instant().minus(KEEP));
        usageRepository.save(usage);
    }

    RecognizeConfig config() {
        Map<String, String> settings = appSettingRepository.findAll().stream()
                .filter(s -> s.getKey().startsWith(RecognizeConfig.KEY_PREFIX))
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
        return RecognizeConfig.from(settings);
    }
}
