package com.srpfreaks.backend.service;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 세트리스트 추천에 쓰는 숫자들. app_settings의 setlist.recommend_* 값을 읽어 온다(RatingConfig와 같은 방식).
 * 값이 없거나 숫자가 아니면 조용히 기본값으로 넘어가지 않고 예외로 알린다.
 */
public record SetlistRecommendConfig(BigDecimal rangeSs, BigDecimal rangeS, int minEntries) {

    public static final String KEY_PREFIX = "setlist.";

    public SetlistRecommendConfig {
        if (rangeSs.signum() <= 0) {
            throw new IllegalStateException("setlist.recommend_range_ss는 0보다 커야 합니다.");
        }
        if (rangeS.compareTo(rangeSs) < 0) {
            // S 채우기는 SS 도전보다 넓은 범위여야 한다(같으면 SS 도전과 겹치는 부분만 남는다)
            throw new IllegalStateException("setlist.recommend_range_s는 setlist.recommend_range_ss 이상이어야 합니다.");
        }
        if (minEntries < 1) {
            throw new IllegalStateException("setlist.recommend_min_entries는 1 이상이어야 합니다.");
        }
    }

    public static SetlistRecommendConfig from(Map<String, String> settings) {
        return new SetlistRecommendConfig(
                decimal(settings, "recommend_range_ss"), decimal(settings, "recommend_range_s"),
                integer(settings, "recommend_min_entries"));
    }

    private static String raw(Map<String, String> settings, String name) {
        String value = settings.get(KEY_PREFIX + name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("설정이 없습니다: " + KEY_PREFIX + name);
        }
        return value.strip();
    }

    private static BigDecimal decimal(Map<String, String> settings, String name) {
        try {
            return new BigDecimal(raw(settings, name));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("설정이 숫자가 아닙니다: " + KEY_PREFIX + name);
        }
    }

    private static int integer(Map<String, String> settings, String name) {
        try {
            return Integer.parseInt(raw(settings, name));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("설정이 정수가 아닙니다: " + KEY_PREFIX + name);
        }
    }
}
