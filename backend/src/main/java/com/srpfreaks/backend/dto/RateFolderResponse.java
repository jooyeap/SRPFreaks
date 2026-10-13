package com.srpfreaks.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 마이페이지 통계의 폴더 하나. key는 레벨 폴더면 시작 레벨(예: 8.00, 0.5 단위), 서열표 난이도면 기준 난이도(예: 6.0).
 * total = 폴더의 전체 채보 수, recorded = 기록이 있는 채보 수(= total - 미플레이 구간 수).
 * buckets는 RateBucket 선언 순서 그대로 7개가 항상 모두 들어 있고(비어 있으면 count 0), count를 합치면 total이다.
 */
public record RateFolderResponse(BigDecimal key, int total, int recorded, List<RateBucketResponse> buckets) {
}
