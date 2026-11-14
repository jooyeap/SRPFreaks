package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 공개 유저 여러 명의 레이팅 후보 한 줄(서열표 분석의 유저별 총점·티어용). {@link RatingCandidate}에 유저 id가 붙은 모양이다.
 * 쿼리가 공개(profile_public) + ACTIVE 유저만 돌려주므로 비공개 유저의 기록은 이 경로로 읽을 수 없다.
 */
public record PublicRatingCandidate(Long userId, Long songDifficultyId, Long songId, String title, String part, String difficulty,
                                    BigDecimal level, BigDecimal tier, String pattern, BigDecimal bestRate, boolean fullCombo,
                                    LocalDateTime achievedAt) {

    public RatingCandidate toCandidate() {
        return new RatingCandidate(songDifficultyId, songId, title, part, difficulty, level, tier, pattern, bestRate, fullCombo, achievedAt);
    }
}
