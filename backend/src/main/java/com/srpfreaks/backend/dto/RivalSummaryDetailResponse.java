package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.util.List;

/**
 * 라이벌 대시보드의 속성별 곡 목록(D67, 5단계). summary는 그 속성 한 줄, filterCounts는 필터 칩(전체·열세·접전·우세)의 곡 수,
 * rows는 필터·정렬을 적용한 한 페이지다. 줄은 공통 줄(ChartLine)에 필요한 값과 양쪽 기록을 담는다.
 * rate·stage·score는 상대, myRate·myStage·myScore는 나(둘 다 기록이 있는 곡만 나오므로 null이 아니다).
 * 필터·정렬·승무패는 rateDiff(= myRate - rate, %p, 달성률 기준. D67 개정)로 하고, diff는 점수 차(옛 필드)라 판정에 쓰지 않는다.
 *
 * <p>2026-11-10 추가: filterCounts.theirsOnly와 필터 `THEIRS_ONLY`(상대만 기록한 곡, 줄의 내 기록 필드는 null), tiers(그 속성의 난이도대별 집계).
 * tiers는 서열표 기준 난이도 0.1 단위로, 두 사람 중 누구라도 기록한 곡이 있는 난이도마다 한 줄이고 공유 곡이 없는 난이도는 sharedCount 0 / rateDiffAvg null이다.
 * 승·무·패·접전은 달성률 차 기준(D67 개정)으로 속성 요약과 같다.
 */
public record RivalSummaryDetailResponse(Long userId, String nickname, RivalSummaryResponse.PatternSummary summary,
                                         FilterCounts filterCounts, PageResponse<Row> rows, List<TierRow> tiers) {

    /** 예전 5개 인자 생성자(난이도대별 집계 없음). */
    public RivalSummaryDetailResponse(Long userId, String nickname, RivalSummaryResponse.PatternSummary summary,
                                      FilterCounts filterCounts, PageResponse<Row> rows) {
        this(userId, nickname, summary, filterCounts, rows, List.of());
    }

    public record FilterCounts(int all, int lose, int close, int win, int theirsOnly) {

        /** 예전 4개 인자 생성자(상대만 없음). */
        public FilterCounts(int all, int lose, int close, int win) {
            this(all, lose, close, win, 0);
        }
    }

    /** 난이도대별 한 줄(서열표 기준 난이도 0.1 단위, 높은 난이도 먼저). 공유 곡이 없으면 sharedCount 0, rateDiffAvg null. */
    public record TierRow(BigDecimal tier, int wins, int ties, int losses, int closeCount, int sharedCount,
                          BigDecimal rateDiffAvg) {
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
