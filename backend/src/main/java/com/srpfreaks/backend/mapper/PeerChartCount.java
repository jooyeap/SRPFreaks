package com.srpfreaks.backend.mapper;

/** 같은 티어 유저 중 이 채보를 레이팅 목록에 넣은 인원 수 한 줄(유저가 누구인지는 담지 않는다, D89). */
public record PeerChartCount(Long songDifficultyId, int users) {
}
