package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;

/**
 * 레이팅 목록의 한 채보. tier = 서열표 기준 난이도(T), ratingConstant = 레이팅상수(R), value = 채보 값(V),
 * score = 화면 점수(V x 20, 소수 둘째 자리까지 반올림해 표시). value는 소수 넷째 자리까지. rank는 그룹(단일/그 외) 안의 순위(1부터).
 */
public record SkillEntryResponse(int rank, Long songDifficultyId, Long songId, String title, InstrumentPart part,
                                 DifficultyType difficulty, BigDecimal level, BigDecimal tier, String pattern,
                                 BigDecimal achievementRate, boolean fullCombo, AchievementStage stage,
                                 BigDecimal ratingConstant, BigDecimal value, BigDecimal score) {
}
