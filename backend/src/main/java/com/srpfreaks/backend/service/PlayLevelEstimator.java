package com.srpfreaks.backend.service;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * "이 사람이 평소 치는 난이도"를 서열표 기준 난이도(T)로 추정한다. 세트리스트 추천이 이 값 ± 범위의 채보를 고른다(D37).
 *
 * 인터페이스로 둔 이유: 지금은 내 레이팅 목록의 평균(OwnRatingPlayLevelEstimator)으로 추정하지만,
 * 나중에 플레이어 레이팅대별 획득 평균 데이터가 쌓이면 그 데이터로 추정하는 구현으로 바꿔 끼울 수 있게 하려는 것이다.
 * 추천 조회와 화면은 이 값만 받으므로 구현을 바꿔도 달라지지 않는다.
 * 추정할 근거가 모자라면 빈 값을 돌려주고, 추천은 "기록이 더 쌓이면 추천해 드려요"로 대신한다.
 */
public interface PlayLevelEstimator {

    Optional<BigDecimal> estimate(Long userId);
}
