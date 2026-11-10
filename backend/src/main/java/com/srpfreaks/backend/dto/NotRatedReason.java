package com.srpfreaks.backend.dto;

/**
 * 이 채보가 레이팅 계산 대상이 아닌 이유 (저장 응답의 ratingChange.notRatedReason, 대상이면 null).
 * TIER_UNDECIDED = 서열표 기준 난이도가 없음(미정), EXCLUDED = 속성이 레이팅 제외/없음이거나 서열표에 없음/반영 끔,
 * NOT_RATED = 서버가 이유를 가리지 못한 경우(예비 값).
 */
public enum NotRatedReason {
    TIER_UNDECIDED, EXCLUDED, NOT_RATED
}
