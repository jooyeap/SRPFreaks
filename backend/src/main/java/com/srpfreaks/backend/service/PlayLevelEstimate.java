package com.srpfreaks.backend.service;

import java.math.BigDecimal;

/**
 * 평소 치는 난이도 추정 결과(D37). 세 가지 경우를 구분한다.
 * - READY        : 평균 난이도(tier)를 믿을 만큼 레이팅 목록이 찼다.
 * - NEW_PLAYER   : 레이팅 목록이 비어 있다(기록 없음). 평균이 없으므로 입문용 추천을 쓴다.
 * - INSUFFICIENT : 기록은 있지만 단일 또는 그 외 채보 수가 최소 개수 미만이라 평균이 흔들린다. 더 채워 달라고 안내한다.
 * ratedSingle/ratedOther는 레이팅 목록에 든 단일 / 그 외 채보 수이고 안내 문구에 그대로 쓴다.
 */
public record PlayLevelEstimate(Status status, BigDecimal tier, int ratedSingle, int ratedOther) {

    public enum Status { READY, NEW_PLAYER, INSUFFICIENT }

    public static PlayLevelEstimate ready(BigDecimal tier, int ratedSingle, int ratedOther) {
        return new PlayLevelEstimate(Status.READY, tier, ratedSingle, ratedOther);
    }

    public static PlayLevelEstimate newPlayer() {
        return new PlayLevelEstimate(Status.NEW_PLAYER, null, 0, 0);
    }

    public static PlayLevelEstimate insufficient(int ratedSingle, int ratedOther) {
        return new PlayLevelEstimate(Status.INSUFFICIENT, null, ratedSingle, ratedOther);
    }
}
