package com.srpfreaks.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 같은 티어 유저 기록(D53). 내 티어와 같은 구간의 공개 유저들이 레이팅 목록에 넣은 채보의 집계값이다(개인 식별 정보 없음).
 *
 * - tierName   : 내 티어 이름(화면에 "같은 티어"를 구체적으로 쓸 때). 티어를 알 수 없으면 null.
 * - bandUsers  : 집계에 쓰인 공개 유저 수("n명 중"의 n).
 * - charts     : 표시 기준(구간 인원·채보 인원)을 넘은 채보만 담긴다. 기준에 못 미치면 비어 있다 -> 화면은 아무것도 보여 주지 않는다.
 *   users          : 그 채보를 레이팅에 넣은 유저 수.
 *   medianRate     : 그 유저들의 달성률 중앙값(소수 둘째 자리).
 *   expectedGain   : 중앙값 달성률로 쳤을 때 오르는 내 점수(0 이상). 레이팅 대상이 아닌 채보면 null.
 *   inMyList/myRate: 이미 내 레이팅 목록에 있으면 true와 내 달성률.
 */
public record PeerStatsResponse(String tierName, int bandUsers, List<PeerChartStat> charts) {

    public record PeerChartStat(Long songDifficultyId, int users, BigDecimal medianRate, BigDecimal expectedGain,
                                boolean inMyList, BigDecimal myRate) {
    }
}
