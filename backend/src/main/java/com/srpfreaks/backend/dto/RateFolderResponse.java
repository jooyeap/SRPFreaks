package com.srpfreaks.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 마이페이지 통계의 폴더 하나. key는 레벨 폴더면 시작 레벨(예: 8.00, 0.5 단위), 서열표 난이도면 기준 난이도(예: 6.0).
 * total = 폴더의 전체 채보 수, recorded = 기록이 있는 채보 수(= total - 미플레이 구간 수).
 * buckets는 RateBucket 선언 순서 그대로 7개가 항상 모두 들어 있고(비어 있으면 count 0), count를 합치면 total이다.
 * 평균은 곡 목록·서열표와 같은 두 가지다. averageRecorded = 기록 있는 채보만의 평균(기록이 하나도 없으면 null),
 * averageWithZero = 기록 없는 채보를 0%로 넣은 평균. 둘 다 소수 둘째 자리(HALF_UP).
 */
public record RateFolderResponse(BigDecimal key, int total, int recorded, BigDecimal averageRecorded,
                                 BigDecimal averageWithZero, List<RateBucketResponse> buckets) {
}
