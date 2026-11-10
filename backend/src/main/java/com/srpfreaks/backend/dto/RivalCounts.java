package com.srpfreaks.backend.dto;

/**
 * 곡별 승패 개수(D56). 둘 다 기록 있는 채보만 이김/짐/같음, 상대만 기록 있으면 theirsOnly. 나만 있는 채보는 승패에 세지 않는다.
 *
 * <p>**세 곳의 개수가 모두 같은 기준이다**(D67 개정, 2026-11-09): 라이벌 카드(`GET /rivals`), 비교 레이팅 목록(`compare/rating`)의 counts,
 * 곡별 승패 보기(`compare/charts`). 모두 라이벌 대시보드 집계(`compare/summary`)의 totals·속성별 onlyTheirs 합과 같은 범위(두 사람이 모두
 * 기록한 레이팅 대상 채보)와 같은 판정(달성률 차: 승 > 0, 패 < 0, 무 = 0)이며, 계산은 {@code RivalSummaryCalculator.countsOf} 한 곳이다.
 * onlyMine은 나만 기록한 레이팅 대상 곡 수(참고용, 승패에 세지 않는다). 예전에는 카드와 비교 목록이 레이팅 대상 여부와 상관없이 모든 활성
 * 채보를 세어 대시보드 숫자와 달랐다.
 */
public record RivalCounts(int win, int lose, int tie, int theirsOnly, int onlyMine) {

    /** 예전 4개 인자 생성자(나만 기록 수 없음). 라이벌 목록 등 기존 호출처가 그대로 쓴다. */
    public RivalCounts(int win, int lose, int tie, int theirsOnly) {
        this(win, lose, tie, theirsOnly, 0);
    }
}
