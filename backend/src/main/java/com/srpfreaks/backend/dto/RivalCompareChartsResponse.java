package com.srpfreaks.backend.dto;

/** 곡별 승패(D56): 네 가지 개수 + 고른 결과(이김/짐/같음/상대만)의 한 페이지. */
public record RivalCompareChartsResponse(RivalCounts counts, PageResponse<RivalChartRow> page) {
}
