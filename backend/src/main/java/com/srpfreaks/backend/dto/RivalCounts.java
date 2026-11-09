package com.srpfreaks.backend.dto;

/**
 * 곡별 승패 개수(D56). 둘 다 기록 있는 채보만 이김/짐/같음, 상대만 기록 있으면 theirsOnly. 나만 있는 채보는 승패에 세지 않는다.
 *
 * <p>곡별 승패 보기(`compare/charts`)의 개수는 라이벌 대시보드 집계(`compare/summary`)의 totals·속성별 onlyTheirs 합과 같은 범위(두 사람이 모두
 * 기록한 레이팅 대상 채보)와 같은 판정(달성률 차)이다(D67 개정, 2026-11-09). onlyMine은 나만 기록한 레이팅 대상 곡 수(참고용, 승패에 세지 않는다).
 * 라이벌 목록(`GET /rivals`)의 승·패·무는 예전 그대로 레이팅 대상 여부와 상관없이 센다.
 */
public record RivalCounts(int win, int lose, int tie, int theirsOnly, int onlyMine) {

    /** 예전 4개 인자 생성자(나만 기록 수 없음). 라이벌 목록 등 기존 호출처가 그대로 쓴다. */
    public RivalCounts(int win, int lose, int tie, int theirsOnly) {
        this(win, lose, tie, theirsOnly, 0);
    }
}
