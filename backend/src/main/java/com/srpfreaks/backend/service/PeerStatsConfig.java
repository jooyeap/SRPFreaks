package com.srpfreaks.backend.service;

import java.util.Map;

/**
 * 같은 티어 유저 기록(D53)의 표시 기준. app_settings의 peer.* 값을 읽어 온다(RatingConfig와 같은 방식).
 * 값이 없거나 숫자가 아니면 조용히 기본값으로 넘어가지 않고 예외로 알린다.
 *
 * - minBandUsers  : 내 티어 구간의 공개 유저(스냅샷 보유)가 이 수 이상이어야 보여 준다.
 * - minChartUsers : 한 채보를 레이팅에 넣은 유저가 이 수 이상이어야 그 채보 줄을 보여 준다.
 */
public record PeerStatsConfig(int minBandUsers, int minChartUsers) {

    public static final String KEY_PREFIX = "peer.";

    public PeerStatsConfig {
        if (minBandUsers < 1 || minChartUsers < 1) {
            throw new IllegalStateException("peer.min_band_users, peer.min_chart_users는 1 이상이어야 합니다.");
        }
    }

    public static PeerStatsConfig from(Map<String, String> settings) {
        return new PeerStatsConfig(integer(settings, "min_band_users"), integer(settings, "min_chart_users"));
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
