package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/** 약점 분석(D72)의 같은 티어 난이도대별 집계 한 줄. band = 묶음의 시작 기준 난이도(예 5.5). 나머지 뜻은 PeerGroupAverage와 같다. */
public record PeerBandAverage(BigDecimal band, long users, long entries, BigDecimal avgRate) {
}
