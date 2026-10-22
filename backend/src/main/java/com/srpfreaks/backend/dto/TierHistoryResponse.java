package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 곡 상세의 서열표 변경 이력 한 줄. 누가 바꿨는지는 내보내지 않는다.
 * created가 true면 "서열표에 추가"이고 before* 값은 null이다. 값이 없는 쪽(예: 기준 난이도가 미정)은 null이다.
 */
public record TierHistoryResponse(Instant changedAt, boolean created, Long songDifficultyId, InstrumentPart part,
                                  DifficultyType difficulty, BigDecimal level, BigDecimal beforeTier,
                                  BigDecimal afterTier, String beforePattern, String afterPattern) {
}
