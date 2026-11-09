package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;

/**
 * 라이벌 대시보드의 속성별 곡 목록(D67, 5단계). summary는 그 속성 한 줄, filterCounts는 필터 칩(전체·열세·접전·우세)의 곡 수,
 * rows는 필터·정렬을 적용한 한 페이지다. 줄은 공통 줄(ChartLine)에 필요한 값과 양쪽 기록을 담는다.
 * rate·stage·score는 상대, myRate·myStage·myScore는 나(둘 다 기록이 있는 곡만 나오므로 null이 아니다).
 * 필터·정렬·승무패는 rateDiff(= myRate - rate, %p, 달성률 기준. D67 개정)로 하고, diff는 점수 차(옛 필드)라 판정에 쓰지 않는다.
 */
public record RivalSummaryDetailResponse(Long userId, String nickname, RivalSummaryResponse.PatternSummary summary,
                                         FilterCounts filterCounts, PageResponse<Row> rows) {

    public record FilterCounts(int all, int lose, int close, int win) {
    }

    public record Row(Long songDifficultyId, Long songId, String title, InstrumentPart part, DifficultyType difficulty,
                      BigDecimal level, BigDecimal tier, String pattern, BigDecimal rate, AchievementStage stage,
                      BigDecimal score, BigDecimal myRate, AchievementStage myStage, BigDecimal myScore, BigDecimal diff,
                      BigDecimal rateDiff) {

        /** 예전 15개 인자 생성자(달성률 차 없음). */
        public Row(Long songDifficultyId, Long songId, String title, InstrumentPart part, DifficultyType difficulty,
                   BigDecimal level, BigDecimal tier, String pattern, BigDecimal rate, AchievementStage stage,
                   BigDecimal score, BigDecimal myRate, AchievementStage myStage, BigDecimal myScore, BigDecimal diff) {
            this(songDifficultyId, songId, title, part, difficulty, level, tier, pattern, rate, stage, score, myRate, myStage,
                    myScore, diff, myRate == null || rate == null ? null : myRate.subtract(rate));
        }
    }
}
