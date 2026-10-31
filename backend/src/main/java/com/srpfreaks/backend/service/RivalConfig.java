package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.repository.AppSettingRepository;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * 라이벌(D56) 설정. app_settings의 rival.* 값을 읽는다(PeerStatsConfig와 같은 방식). 값이 없거나 1 미만이면 예외로 알린다.
 *
 * - maxCount           : 한 사람이 등록할 수 있는 라이벌 수
 * - notifyDelayMinutes : 역전 알림을 저장 몇 분 뒤에 보일지(그때 다시 확인해서 고친 기록을 거른다)
 * - notifyDailyPerRival: 한 상대에게서 하루(서울 날짜) 따로 보이는 알림 수. 넘으면 그날 한 줄로 묶는다
 * - notifyKeepDays     : 알림 보관 일수
 */
public record RivalConfig(int maxCount, int notifyDelayMinutes, int notifyDailyPerRival, int notifyKeepDays) {

    public static final String KEY_PREFIX = "rival.";

    public RivalConfig {
        if (maxCount < 1 || notifyDelayMinutes < 1 || notifyDailyPerRival < 1 || notifyKeepDays < 1) {
            throw new IllegalStateException("rival.* 설정은 1 이상이어야 합니다.");
        }
    }

    public static RivalConfig from(Map<String, String> settings) {
        return new RivalConfig(integer(settings, "max_count"), integer(settings, "notify_delay_minutes"),
                integer(settings, "notify_daily_per_rival"), integer(settings, "notify_keep_days"));
    }

    /** app_settings에서 rival.* 만 읽어 만든다(설정 테이블은 작아서 전부 읽어도 가볍다). */
    public static RivalConfig load(AppSettingRepository repository) {
        return from(repository.findAll().stream()
                .filter(s -> s.getKey().startsWith(KEY_PREFIX))
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue)));
    }

    private static int integer(Map<String, String> settings, String name) {
        String value = settings.get(KEY_PREFIX + name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("설정이 없습니다: " + KEY_PREFIX + name);
        }
        try {
            return Integer.parseInt(value.strip());
        } catch (NumberFormatException e) {
            throw new IllegalStateException("설정이 정수가 아닙니다: " + KEY_PREFIX + name);
        }
    }
}
