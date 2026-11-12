package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/**
 * 약점 분석(D72)의 같은 티어 속성별 집계 한 줄. 개인이 드러나지 않는 값만 있다(유저 식별 정보 없음).
 * pattern = 속성 라벨(복합(단일)은 복합으로 합쳐 온다), users = 이 속성의 채보를 레이팅 목록에 넣은 서로 다른 유저 수,
 * entries = 그 채보 줄 수, avgRate = 그 줄들의 달성률 평균(채보 가중).
 */
public record PeerGroupAverage(String pattern, long users, long entries, BigDecimal avgRate) {
}
