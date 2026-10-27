package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/** 같은 티어 유저가 레이팅 목록에 넣은 채보 하나의 달성률 한 줄(유저가 누구인지는 담지 않는다). */
public record PeerChartRate(Long songDifficultyId, BigDecimal rate) {
}
