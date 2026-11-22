package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.PatternType;

import java.math.BigDecimal;

/**
 * 서열표 항목에서 채보 하나의 속성(패턴 유형)과 기준 난이도(tier_label)를 읽은 값.
 * 속성이 비어 있으면 patternType은, 기준 난이도가 미정이면 tier는 null.
 * 속성 필터·칩 개수는 앞의 두 값만 쓰므로 2개짜리 생성자를 남겼다(기존 호출·테스트 호환).
 */
public record ChartPattern(Long songDifficultyId, PatternType patternType, BigDecimal tier) {

    public ChartPattern(Long songDifficultyId, PatternType patternType) {
        this(songDifficultyId, patternType, null);
    }
}
