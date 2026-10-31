package com.srpfreaks.backend.dto;

/** 곡별 승패 개수(D56). 둘 다 기록 있는 채보만 이김/짐/같음, 상대만 기록 있으면 theirsOnly. 나만 있는 채보는 세지 않는다. */
public record RivalCounts(int win, int lose, int tie, int theirsOnly) {
}
