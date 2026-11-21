package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 폴더 분포(D88)의 한 줄 = 공개 유저 한 명의 한 기준 난이도 폴더(0.1 단위). chartCount = 그 폴더에서 이 유저가 기록한 채보 수,
 * sumRate = 그 채보들의 최고 달성률 합(평균 = sumRate / chartCount),
 * lastRecordedAt = 그 채보 기록을 가장 최근에 저장·수정한 시각(UTC 그대로, 서비스가 Instant로 바꾼다). 이메일·역할·Google ID는 없다.
 */
public record FolderUserRow(Long userId, String nickname, BigDecimal tier, int chartCount, BigDecimal sumRate, LocalDateTime lastRecordedAt) {
}
