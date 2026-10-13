package com.srpfreaks.backend.dto;

/**
 * 채보 목록 정렬(마이페이지 통계의 폴더 안 목록). LEVEL은 기존 순서(레벨 높은 순 -> 곡명 -> id)다.
 * RATE_DESC/RATE_ASC는 내 달성률 순이고 기록 없는 채보(미플레이)는 항상 맨 뒤에 둔다. 같은 달성률이면 LEVEL 순서를 따른다.
 * 정렬 기준은 이 enum 값으로만 받는다(문자열을 그대로 쿼리에 쓰지 않는다).
 */
public enum ChartSort {
    LEVEL, RATE_DESC, RATE_ASC
}
