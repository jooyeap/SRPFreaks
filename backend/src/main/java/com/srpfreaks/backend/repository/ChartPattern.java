package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.PatternType;

/** 서열표 항목에서 채보 하나의 속성(패턴 유형)만 읽은 값. 속성이 비어 있으면 patternType은 null. */
public record ChartPattern(Long songDifficultyId, PatternType patternType) {
}
