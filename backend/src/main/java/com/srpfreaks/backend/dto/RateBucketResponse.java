package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.RateBucket;

/**
 * 폴더 안 달성률 구간 하나의 채보 수. count는 이 구간에 속한 채보 전체이고, exc·fc는 그 중 일부를 따로 센 값이다
 * (구간은 달성률만 보므로 MAX/FC는 구간을 옮기지 않는다).
 * exc = 달성률 100.00인 채보(MAX). fc = 풀콤보 기록이 있고 100.00 미만인 채보. 100.00은 FC 표시가 있어도 exc로만 센다.
 * 미플레이·73 미만 구간에서 exc는 항상 0이다.
 */
public record RateBucketResponse(RateBucket bucket, int count, int exc, int fc) {
}
