package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.PatternType.RatingGroup;

import java.math.BigDecimal;

/**
 * 기록을 저장한 직후 "내 레이팅이 어떻게 바뀌었는지" (저장 응답에만 담긴다. 본인 데이터만 담는다).
 * entered = 이 채보가 이번 저장으로 레이팅 목록(단일 15 + 그 외 25)에 새로 들어갔는가(화면에 NEW 표시),
 * inList = 저장 뒤에 이 채보가 레이팅 목록에 들어 있는가. 목록 밖이면 점수가 올라도 레이팅은 그대로다.
 *
 * 아래는 저장 결과 카드 2단계에서 더한 선택(nullable) 필드다. 구버전 화면은 몰라도 되고, 계산하지 못하면 null이다.
 * - notRatedReason: 레이팅 대상이 아닌 이유(대상이면 null).
 * - group / rank / groupLimit: 대상일 때 속한 그룹(SINGLE/OTHER), 저장 뒤 그룹 안 순위(목록 밖이면 null), 그룹 한도.
 * - scoreBefore / scoreAfter: 이 곡(채보) 점수의 전/후(둘째 자리 표시값). 이전 기록이 없으면 scoreBefore는 null.
 * - pointsToList: 목록 밖일 때 그룹 마지막 자리까지 남은 점수(그룹이 덜 찼거나 이미 안이면 null).
 * - newBest / previousBestRate / loweredBest: 이번 기록이 이전 최고보다 높은가(이전 기록이 없으면 true),
 *   이전 최고 달성률, 고쳐서 최고 기록이 내려갔는가.
 */
public record RatingChangeResponse(BigDecimal totalBefore, BigDecimal totalAfter, BigDecimal change,
                                   boolean entered, boolean inList,
                                   NotRatedReason notRatedReason, RatingGroup group, Integer rank, Integer groupLimit,
                                   BigDecimal scoreBefore, BigDecimal scoreAfter, BigDecimal pointsToList,
                                   Boolean newBest, BigDecimal previousBestRate, Boolean loweredBest) {

    /** 기본 5개 값만 있는 응답(상세 필드는 모두 null). */
    public RatingChangeResponse(BigDecimal totalBefore, BigDecimal totalAfter, BigDecimal change,
                                boolean entered, boolean inList) {
        this(totalBefore, totalAfter, change, entered, inList, null, null, null, null, null, null, null, null, null, null);
    }
}
