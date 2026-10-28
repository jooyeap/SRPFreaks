package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.Role;

import java.util.Map;

/**
 * 사진 입력(D55) 설정. app_settings의 recognize.* 값을 읽는다(RatingConfig와 같은 방식).
 * 값이 없거나 형식이 틀리면 기본값으로 넘어가지 않고 예외로 알린다(설정 화면은 이 검사로 잘못된 값을 거절한다).
 *
 * - enabled         : 끄는 스위치
 * - minRole         : 쓸 수 있는 가장 낮은 역할. ADMIN(시험 기간: ROOT·ADMIN) 또는 USER(모든 로그인 사용자). ROOT는 받지 않는다.
 * - weeklyLimit     : 사용자당 최근 7일 장수(1 이상)
 * - dailyTotalLimit : 전체 하루(서울 날짜) 장수(1 이상)
 */
public record RecognizeConfig(boolean enabled, Role minRole, int weeklyLimit, int dailyTotalLimit) {

    public static final String KEY_PREFIX = "recognize.";

    public RecognizeConfig {
        if (minRole != Role.ADMIN && minRole != Role.USER) {
            throw new IllegalStateException("recognize.min_role은 ADMIN 또는 USER여야 합니다.");
        }
        if (weeklyLimit < 1 || dailyTotalLimit < 1) {
            throw new IllegalStateException("recognize 한도는 1 이상이어야 합니다.");
        }
    }

    public static RecognizeConfig from(Map<String, String> settings) {
        String enabled = text(settings, "enabled");
        if (!enabled.equals("true") && !enabled.equals("false")) {
            throw new IllegalStateException("설정이 true/false가 아닙니다: " + KEY_PREFIX + "enabled");
        }
        Role role;
        try {
            role = Role.valueOf(text(settings, "min_role"));
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("설정이 역할 이름이 아닙니다: " + KEY_PREFIX + "min_role");
        }
        return new RecognizeConfig(Boolean.parseBoolean(enabled), role, integer(settings, "weekly_limit"), integer(settings, "daily_total_limit"));
    }

    /**
     * 이 역할이 쓸 수 있는가. RoleHierarchy(ROOT > ADMIN > USER)와 같은 순서로 비교한다:
     * minRole이 ADMIN이면 ROOT·ADMIN, USER면 모두. 공개 전환은 설정 값만 바꾸면 되도록 판단을 여기 한 곳에 둔다.
     */
    public boolean allows(Role role) {
        return rank(role) >= rank(minRole);
    }

    private static int rank(Role role) {
        return switch (role) {
            case ROOT -> 3;
            case ADMIN -> 2;
            case USER -> 1;
        };
    }

    private static String text(Map<String, String> settings, String name) {
        String value = settings.get(KEY_PREFIX + name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("설정이 없습니다: " + KEY_PREFIX + name);
        }
        return value.strip();
    }

    private static int integer(Map<String, String> settings, String name) {
        try {
            return Integer.parseInt(text(settings, name));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("설정이 정수가 아닙니다: " + KEY_PREFIX + name);
        }
    }
}
