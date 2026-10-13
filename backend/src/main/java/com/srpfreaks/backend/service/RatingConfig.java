package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.NoteOption;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 레이팅 계산에 쓰는 숫자들. app_settings의 rating.* 값을 읽어 온다 (수식의 모양은 RatingCalculator에 있고 숫자만 여기서 온다).
 * 값이 없거나 숫자가 아니면 조용히 기본값으로 넘어가지 않고 예외로 알린다 -> 잘못된 설정으로 틀린 점수를 내는 것보다 낫다.
 */
public record RatingConfig(BigDecimal pivot, BigDecimal highSlope, BigDecimal highOffset,
                           BigDecimal lowSlope, BigDecimal lowOffset,
                           BigDecimal capRate, BigDecimal maxRate, BigDecimal bonus, BigDecimal scoreMultiplier,
                           int listSingle, int listOther, NoteOption noteOption) {

    public static final String KEY_PREFIX = "rating.";

    public RatingConfig {
        if (maxRate.compareTo(capRate) <= 0) {
            // 80~95 구간 길이로 나누므로 0 이하이면 계산이 깨진다
            throw new IllegalStateException("rating.max_rate는 rating.cap_rate보다 커야 합니다.");
        }
        if (listSingle < 0 || listOther < 0) {
            throw new IllegalStateException("레이팅 목록 개수는 0 이상이어야 합니다.");
        }
    }

    /** 설정 키(rating.pivot 등) -> 값 문자열 맵에서 만든다. */
    public static RatingConfig from(Map<String, String> settings) {
        return new RatingConfig(
                decimal(settings, "pivot"), decimal(settings, "high_slope"), decimal(settings, "high_offset"),
                decimal(settings, "low_slope"), decimal(settings, "low_offset"),
                decimal(settings, "cap_rate"), decimal(settings, "max_rate"), decimal(settings, "bonus"),
                decimal(settings, "score_multiplier"),
                integer(settings, "list_single"), integer(settings, "list_other"),
                noteOption(settings));
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

    private static NoteOption noteOption(Map<String, String> settings) {
        try {
            return NoteOption.valueOf(raw(settings, "note_option"));
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("설정이 노트 옵션이 아닙니다: " + KEY_PREFIX + "note_option");
        }
    }
}
