package com.srpfreaks.backend.dto;

import java.math.BigDecimal;

/**
 * 곡 목록의 레벨 폴더 하나(0.5 단위, 예: 9.50 ~ 9.99). 칩 개수와 평균은 서열표 묶음과 같은 규칙이다(D24):
 * 단계는 가장 높은 하나만 세고, S 미만(A/B/C)은 belowS로 합치며, 기록 없는 채보는 어느 칩에도 세지 않는다.
 * 평균은 소수 둘째 자리. 기록이 없으면 averageRecorded는 null이고 averageWithZero는 0.00이다.
 */
public record ChartFolderResponse(BigDecimal lo, BigDecimal hi, int total, int recorded, int exc, int fc, int ss,
                                  int s, int belowS, BigDecimal averageRecorded, BigDecimal averageWithZero) {
}
