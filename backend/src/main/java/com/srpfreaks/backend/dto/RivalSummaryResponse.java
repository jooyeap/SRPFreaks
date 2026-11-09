package com.srpfreaks.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 라이벌 대시보드 집계(D67, 5단계). 두 사람이 모두 기록한 레이팅 대상 채보 전체를 속성별·서열 난이도별로 센다.
 * 모든 차이는 diff = 내 점수 - 상대 점수(표시 둘째 자리 값끼리 뺀 값)이고, 승 diff > 0 / 패 diff < 0 / 무 diff = 0,
 * 접전은 |diff| <= closeMargin(경계 포함, 무도 포함)이다. 읽기 전용이며 이메일·역할·Google ID는 들어 있지 않다.
 * 총점·티어는 넣지 않는다(헤더는 기존 compare/rating 응답을 쓴다).
 */
public record RivalSummaryResponse(Long userId, String nickname, BigDecimal closeMargin, Totals totals,
                                   List<PatternSummary> patterns, List<TierSummary> tiers,
                                   List<PatternDiffs> distribution) {

    /** 전체 합계. 속성별 합과 같다. */
    public record Totals(int wins, int ties, int losses, int closeCount, int sharedCount, BigDecimal scoreDiffSum) {
    }

    /** 속성 한 줄. pattern은 화면에 보이는 라벨(`복합(단일)` 등), key는 상세 경로에 쓰는 영문 키(`COMPOSITE_SINGLE` 등). */
    public record PatternSummary(String pattern, String key, int wins, int ties, int losses, BigDecimal scoreDiffSum,
                                 int closeCount, int sharedCount) {
    }

    /** 서열 난이도(0.1 단위) 한 줄. 공유 곡이 있는 난이도만, 높은 난이도 먼저. */
    public record TierSummary(BigDecimal tier, int wins, int ties, int losses) {
    }

    /** 분포 차트용: 속성별 곡마다의 차이(곡 id는 없다), 작은 값부터. */
    public record PatternDiffs(String pattern, String key, List<BigDecimal> diffs) {
    }
}
