package com.srpfreaks.backend.service;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 세트리스트 추천에 쓰는 숫자들. app_settings의 setlist.recommend_* 값을 읽어 온다(RatingConfig와 같은 방식).
 * 값이 없거나 숫자가 아니면 조용히 기본값으로 넘어가지 않고 예외로 알린다.
 *
 * - ssMin/ssMax : SS 기준 후보 범위. 내 평균 난이도 + 이 값(음수면 평균보다 쉬운 곡)의 하한~상한.
 * - sMin/sMax   : S 기준 후보 범위(같은 방식).
 * - minSingle/minOther : 평균을 믿으려면 레이팅 목록에 단일 / 그 외 채보가 각각 최소 이 개수 있어야 한다.
 * - starterTier : 레이팅 목록이 비어 있는 신규 사용자에게 보여 줄 기준 난이도 상한.
 */
public record SetlistRecommendConfig(BigDecimal ssMin, BigDecimal ssMax, BigDecimal sMin, BigDecimal sMax,
                                     int minSingle, int minOther, BigDecimal starterTier) {

    public static final String KEY_PREFIX = "setlist.";

    public SetlistRecommendConfig {
        if (ssMin.compareTo(ssMax) > 0) {
            throw new IllegalStateException("setlist.recommend_ss_min은 setlist.recommend_ss_max 이하여야 합니다.");
        }
        if (sMin.compareTo(sMax) > 0) {
            throw new IllegalStateException("setlist.recommend_s_min은 setlist.recommend_s_max 이하여야 합니다.");
        }
        if (minSingle < 1 || minOther < 1) {
            throw new IllegalStateException("setlist.recommend_min_single, setlist.recommend_min_other는 1 이상이어야 합니다.");
        }
        if (starterTier.signum() <= 0) {
            throw new IllegalStateException("setlist.recommend_starter_tier는 0보다 커야 합니다.");
        }
    }

    public static SetlistRecommendConfig from(Map<String, String> settings) {
        return new SetlistRecommendConfig(
                decimal(settings, "recommend_ss_min"), decimal(settings, "recommend_ss_max"),
                decimal(settings, "recommend_s_min"), decimal(settings, "recommend_s_max"),
                integer(settings, "recommend_min_single"), integer(settings, "recommend_min_other"),
                decimal(settings, "recommend_starter_tier"));
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
