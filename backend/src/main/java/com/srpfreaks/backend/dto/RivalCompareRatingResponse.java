package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.util.List;

/**
 * 상대 레이팅 목록에 내 점수를 나란히(D56, gsv.fun 방식). 줄은 상대의 레이팅 목록 그대로(단일·그 외)이고,
 * myRate/myScore는 같은 채보의 내 최고 기록을 같은 기준 난이도로 계산한 값이다. 내 기록이 없으면 셋 다 null.
 * diff = 내 점수 - 상대 점수(양수면 내가 높다).
 */
public record RivalCompareRatingResponse(Long userId, String nickname, PlayerTierResponse tier, BigDecimal totalScore,
                                         PlayerTierResponse myTier, BigDecimal myTotalScore, RivalCounts counts,
                                         List<Row> single, List<Row> other) {

    public record Row(int rank, Long songDifficultyId, Long songId, String title, InstrumentPart part,
                      DifficultyType difficulty, BigDecimal level, BigDecimal tier, BigDecimal rate,
                      AchievementStage stage, BigDecimal score, BigDecimal myRate, BigDecimal myScore, BigDecimal diff) {
    }
}
