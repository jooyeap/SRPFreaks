package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.repository.AppSettingRepository;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * 서열표 변경 알림(D61) 설정. app_settings의 tier.notify_* 값을 읽는다(RivalConfig와 같은 방식). 값이 없거나 1 미만이면 예외로 알린다.
 *
 * - keepDays  : 알림 보관 일수. 이보다 오래된 서열표 변경은 알림으로 만들지도 않는다
 * - bundleOver: 한 번 확인할 때 새 알림이 이 개수를 넘으면 한 줄로 묶는다(5면 6건부터 묶음)
 */
public record TierNotifyConfig(int keepDays, int bundleOver) {

    public static final String KEY_PREFIX = "tier.notify_";

    public TierNotifyConfig {
        if (keepDays < 1 || bundleOver < 1) {
            throw new IllegalStateException("tier.notify_* 설정은 1 이상이어야 합니다.");
        }
    }

    public static TierNotifyConfig from(Map<String, String> settings) {
        return new TierNotifyConfig(integer(settings, "keep_days"), integer(settings, "bundle_over"));
    }

    public static TierNotifyConfig load(AppSettingRepository repository) {
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
