package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 서열표 변경 목록(D58) 한 줄. 누가 바꿨는지는 내보내지 않는다.
 * created가 true면 "서열표에 추가"이고 before* 값은 null이다. 값이 없는 쪽(예: 기준 난이도 미정)은 null이다.
 * 바뀌지 않은 항목도 전·후 값이 같은 채로 오므로, 화면은 전·후가 다른 항목만 글로 쓴다.
 */
public record TierChangeResponse(Instant changedAt, boolean created, Long songId, String title, Long songDifficultyId,
                                 InstrumentPart part, DifficultyType difficulty, BigDecimal level,
                                 BigDecimal beforeTier, BigDecimal afterTier, String beforePattern,
                                 String afterPattern, String beforeRecommend, String afterRecommend) {
}
