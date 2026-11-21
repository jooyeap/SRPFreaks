package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 폴더 분포 상세(D97)의 한 줄 = 한 유저의 한 채보. bestRate는 (유저, 채보)당 최고 달성률(집계와 같은 값), fullCombo는 그 채보에 풀콤보 기록이 하나라도 있는지,
 * lastSavedAt은 그 채보 기록의 마지막 저장·수정 시각(UTC 그대로, 서비스가 Instant로 바꾼다).
 * counted = 폴더 평균(findFolderUserAverages)에 들어간 채보인가(false면 같은 폴더에 기록은 있지만 레이팅 제외 등으로 평균에서 빠진 채보).
 * 이메일·역할·Google ID는 없다.
 */
public record FolderRecordRow(Long songDifficultyId, Long songId, String title, String part, String difficulty, BigDecimal level,
                              BigDecimal tier, BigDecimal bestRate, boolean fullCombo, LocalDateTime lastSavedAt, boolean counted) {
}
