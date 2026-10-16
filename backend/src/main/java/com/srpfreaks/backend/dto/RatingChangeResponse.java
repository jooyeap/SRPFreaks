package com.srpfreaks.backend.dto;

import java.math.BigDecimal;

/**
 * 기록을 저장한 직후 "내 레이팅이 어떻게 바뀌었는지" (저장 응답에만 담긴다).
 * entered = 이 채보가 이번 저장으로 레이팅 목록(단일 15 + 그 외 25)에 새로 들어갔는가(화면에 NEW 표시),
 * inList = 저장 뒤에 이 채보가 레이팅 목록에 들어 있는가. 목록 밖이면 점수가 올라도 레이팅은 그대로다.
 */
public record RatingChangeResponse(BigDecimal totalBefore, BigDecimal totalAfter, BigDecimal change,
                                   boolean entered, boolean inList) {
}
