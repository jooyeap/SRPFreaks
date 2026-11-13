package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.repository.AppSettingRepository;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * 내 리스트(D76) 설정. app_settings의 list.* 값을 읽는다(RivalConfig와 같은 방식). 값이 없거나 1 미만이면 예외로 알린다.
 *
 * - maxLists : 한 사람이 만들 수 있는 리스트 수
 * - maxItems : 리스트 하나에 담을 수 있는 곡 수
 * 숫자는 코드에 두지 않고 마이그레이션이 정한 기본값(10, 50)을 ROOT가 바꾼다.
 */
public record UserListConfig(int maxLists, int maxItems) {

    public static final String KEY_PREFIX = "list.";

    public UserListConfig {
        if (maxLists < 1 || maxItems < 1) {
            throw new IllegalStateException("list.* 설정은 1 이상이어야 합니다.");
        }
    }

    public static UserListConfig from(Map<String, String> settings) {
        return new UserListConfig(integer(settings, "max_lists"), integer(settings, "max_items"));
    }

    /** app_settings에서 list.* 만 읽어 만든다(설정 테이블은 작아서 전부 읽어도 가볍다). */
    public static UserListConfig load(AppSettingRepository repository) {
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
