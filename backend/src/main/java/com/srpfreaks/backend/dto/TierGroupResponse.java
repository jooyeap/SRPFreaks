package com.srpfreaks.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 기준 난이도 묶음. tier가 null이면 "미정" 묶음.
 * 칩 개수(exc/fc/ss/s)는 각 채보의 가장 높은 단계 하나만 센다.
 * 평균은 두 가지를 모두 내린다(화면의 "0% 미포함/포함" 토글이 서버 호출 없이 바뀌도록):
 * averageRecorded = 기록 있는 채보만, averageWithZero = 기록 없는 채보를 0%로 넣은 값.
 * 기록이 하나도 없으면 averageRecorded는 null(화면 "–"), averageWithZero는 0.00.
 */
public record TierGroupResponse(BigDecimal tier, int total, int recorded,
                                int exc, int fc, int ss, int s,
                                BigDecimal averageRecorded, BigDecimal averageWithZero,
                                List<TableEntryResponse> entries) {
}
