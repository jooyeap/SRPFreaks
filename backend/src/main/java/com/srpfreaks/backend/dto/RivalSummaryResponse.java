package com.srpfreaks.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 라이벌 대시보드 집계(D67). 두 사람이 모두 기록한 레이팅 대상 채보 전체를 속성별·서열 난이도별로 센다.
 *
 * <p>**판정 기준은 달성률이다(D67 개정, 2026-11-09).** diff = 내 달성률 - 상대 달성률(DB의 둘째 자리 값 그대로 뺀 %p, 반올림 없음).
 * 승 diff > 0 / 패 diff < 0 / 무 diff = 0(달성률이 정확히 같을 때만), 접전은 |diff| <= closeMargin(%p, 경계 포함, 무도 포함)이다.
 * 예전(5단계)에는 점수 차로 판정했는데 점수는 달성률 95%부터 같아져서 95% 이상이 모두 무가 되었다.
 * 점수 차 합계(scoreDiffSum)와 점수 차 분포(distribution)는 옛 프론트가 깨지지 않도록 필드로 남겨 두었고 판정에는 쓰지 않는다.
 * 읽기 전용이며 이메일·역할·Google ID는 들어 있지 않다. 총점·티어는 넣지 않는다(헤더는 기존 compare/rating 응답을 쓴다).
 * rateDistribution은 점 분포 차트용 달성률 차(%p)이다.
 */
public record RivalSummaryResponse(Long userId, String nickname, BigDecimal closeMargin, Totals totals,
                                   List<PatternSummary> patterns, List<TierSummary> tiers,
                                   List<PatternDiffs> distribution, List<PatternDiffs> rateDistribution) {

    /** 예전 7개 인자 생성자(달성률 차 분포 없음). 기존 호출처가 그대로 컴파일되게 남겨 둔다. */
    public RivalSummaryResponse(Long userId, String nickname, BigDecimal closeMargin, Totals totals,
                                List<PatternSummary> patterns, List<TierSummary> tiers, List<PatternDiffs> distribution) {
        this(userId, nickname, closeMargin, totals, patterns, tiers, distribution, List.of());
    }

    /** 전체 합계. 속성별 합과 같다(wins·ties·losses·closeCount는 달성률 기준, scoreDiffSum은 참고용 점수 차 합계). */
    public record Totals(int wins, int ties, int losses, int closeCount, int sharedCount, BigDecimal scoreDiffSum) {
    }

    /**
     * 속성 한 줄. pattern은 화면에 보이는 라벨(`복합(단일)` 등), key는 상세 경로에 쓰는 영문 키(`COMPOSITE_SINGLE` 등).
     * rateDiffAvg = 공유 곡마다 (내 최고 달성률 - 상대 최고 달성률)을 평균낸 값(%p, 소수 첫째 자리, 절반은 0에서 먼 쪽으로 반올림).
     * 달성률은 DB에 저장된 둘째 자리 값 그대로 뺀다(점수와 달리 95%에서 멈추지 않는다). 공유 곡이 0이면 null.
     * wins·ties·losses·closeCount는 달성률 차 기준이다(D67 개정). scoreDiffSum은 점수 차 합계로 옛 필드라 남겨 두었고 판정에 쓰지 않는다.
     * onlyTheirs = 상대만 기록한(나는 기록이 없는) 레이팅 대상 곡 수, onlyMine = 나만 기록한 곡 수. 승·무·패·평균에 넣지 않는다(0%로 보지 않는다).
     */
    public record PatternSummary(String pattern, String key, int wins, int ties, int losses, BigDecimal scoreDiffSum,
                                 int closeCount, int sharedCount, BigDecimal rateDiffAvg, int onlyTheirs, int onlyMine) {

        /** 예전 9개 인자 생성자(미플레이 수 없음). */
        public PatternSummary(String pattern, String key, int wins, int ties, int losses, BigDecimal scoreDiffSum,
                              int closeCount, int sharedCount, BigDecimal rateDiffAvg) {
            this(pattern, key, wins, ties, losses, scoreDiffSum, closeCount, sharedCount, rateDiffAvg, 0, 0);
        }

        /** 예전 8개 인자 생성자(달성률 차 평균·미플레이 수 없음). 기존 호출처가 그대로 컴파일되게 남겨 둔다. */
        public PatternSummary(String pattern, String key, int wins, int ties, int losses, BigDecimal scoreDiffSum,
                              int closeCount, int sharedCount) {
            this(pattern, key, wins, ties, losses, scoreDiffSum, closeCount, sharedCount, null, 0, 0);
        }
    }

    /** 서열 난이도(0.1 단위) 한 줄. 공유 곡이 있는 난이도만, 높은 난이도 먼저. */
    public record TierSummary(BigDecimal tier, int wins, int ties, int losses) {
    }

    /** 분포 차트용: 속성별 곡마다의 차이(곡 id는 없다), 작은 값부터. distribution은 점수 차(옛 필드), rateDistribution은 달성률 차(%p). */
    public record PatternDiffs(String pattern, String key, List<BigDecimal> diffs) {
    }
}
