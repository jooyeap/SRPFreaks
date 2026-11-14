package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/**
 * 서열표 분석(D77)의 채보 한 줄 = 공개 유저들의 이 채보 SRN+ 기록 집계.
 * players = 기록이 있는 공개 유저 수(사람), records = 그 유저들이 저장한 기록 건수 합, sumRate = 유저별 최고 달성률의 합(평균은 서비스가 낸다),
 * recentRecords = 최근 7일(Asia/Seoul 달력 기준)에 저장된 기록 건수. tier는 서열표 기준 난이도(없으면 미정 = null).
 * 유저 식별 정보(user_id, 닉네임, 이메일 등)는 이 줄에 없다.
 */
public record ChartAggregateRow(Long songDifficultyId, Long songId, String title, String part, String difficulty, BigDecimal level,
                                BigDecimal tier, int players, long records, BigDecimal sumRate, long recentRecords) {
}
