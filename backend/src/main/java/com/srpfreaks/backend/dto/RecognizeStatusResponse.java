package com.srpfreaks.backend.dto;

import java.time.Instant;

/**
 * 사진 입력(D55)을 지금 쓸 수 있는지. 화면은 이것만 보고 탭을 그린다(역할 이름은 내보내지 않는다).
 *
 * @param available    지금 한 장 인식할 수 있는가
 * @param reason       못 쓰는 이유. DISABLED(꺼짐) / ROLE(권한 없음) / WEEKLY_LIMIT(최근 7일 한도) / DAILY_LIMIT(오늘 전체 한도). 쓸 수 있으면 null
 * @param remaining    최근 7일 한도 중 남은 장수(DISABLED·ROLE이면 0)
 * @param weeklyLimit  최근 7일 한도
 * @param nextRefillAt 다시 쓸 수 있게 되는 시각(UTC). WEEKLY_LIMIT·DAILY_LIMIT일 때만, 그 밖에는 null
 */
public record RecognizeStatusResponse(boolean available, String reason, int remaining, int weeklyLimit, Instant nextRefillAt) {
}
