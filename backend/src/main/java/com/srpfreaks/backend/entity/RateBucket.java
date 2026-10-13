package com.srpfreaks.backend.entity;

import java.math.BigDecimal;

/**
 * 마이페이지 통계의 달성률 구간(폴더). 채보의 대표 기록(최고 달성률) 하나로 정해지고, 한 채보는 한 구간에만 들어간다.
 * 구간 경계는 아래값을 포함한다(95.00은 R95, 94.99는 R90). 그래서 구간끼리 겹치지 않고 합치면 전체 채보 수가 된다.
 *
 * AchievementStage(달성 단계)와 다른 점: 단계는 FC·EXC가 달성률보다 우선하지만, 구간은 달성률만 본다.
 * 풀콤보(FC)나 100.00(MAX)은 구간을 바꾸지 않고 구간 안의 별도 개수(RateBucketResponse의 exc/fc)로만 센다.
 *
 * 선언 순서가 화면 표시 순서(달성률 높은 구간이 위, 미플레이가 맨 아래)다.
 */
public enum RateBucket {
    R95("95.00"),
    R90("90.00"),
    R85("85.00"),
    R80("80.00"),
    R73("73.00"),
    /** 73 미만 (A 미만: B·C 단계). 기록은 있다 */
    BELOW(null),
    /** 기록이 없는 채보 */
    UNPLAYED(null);

    private final BigDecimal lowerBound;

    RateBucket(String lowerBound) {
        this.lowerBound = lowerBound == null ? null : new BigDecimal(lowerBound);
    }

    /** 달성률(0.00 ~ 100.00)이 속한 구간. 기록이 없으면(null) UNPLAYED. */
    public static RateBucket of(BigDecimal rate) {
        if (rate == null) {
            return UNPLAYED;
        }
        for (RateBucket bucket : values()) {
            if (bucket.lowerBound != null && rate.compareTo(bucket.lowerBound) >= 0) {
                return bucket;
            }
        }
        return BELOW;
    }
}
