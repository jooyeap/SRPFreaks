package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 곡별 순위(D74)의 한 줄 = 공개 유저 한 명의 한 채보 최고 기록.
 * 이메일·역할·Google ID는 쿼리에서 select 하지 않는다(그래서 이 레코드에도 없다).
 *
 * achievedAt = 그 최고 달성률을 가진 기록들 중 가장 이른 option_records.created_at(서버가 저장한 시각, 사용자가 입력할 수 없다).
 * played_at이 아니라 created_at인 이유: played_at은 사용자가 고칠 수 있어서 동점 순서를 마음대로 앞당기는 데 쓰일 수 있다.
 * 시각끼리 순서만 비교하므로 시간대 변환이 필요 없는 LocalDateTime으로 받는다.
 */
public record RankingRow(Long userId, String nickname, BigDecimal bestRate, boolean fullCombo, LocalDateTime achievedAt) {
}
