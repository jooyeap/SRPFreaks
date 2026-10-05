package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.NoteOption;

import java.math.BigDecimal;
import java.util.List;

/**
 * 내 레이팅 목록 (SRN+ 하나, 단일 15 + 그 외 25). 목록이 모자라면 있는 만큼만 담긴다.
 * 점수는 반올림하지 않고 계산해서 더한 뒤 화면용으로 소수 둘째 자리까지만 반올림해 내보낸다(D20).
 * 그래서 항목 점수를 더한 값과 합계의 마지막 자리가 0.01 어긋날 수 있다. 플레이어 티어는 반올림 전 합계의 정수부로 정한다.
 */
public record SkillResponse(NoteOption noteOption, BigDecimal totalScore, BigDecimal singleScore, BigDecimal otherScore,
                            PlayerTierResponse tier, int singleLimit, int otherLimit,
                            List<SkillEntryResponse> single, List<SkillEntryResponse> other) {

    /** 플레이어 티어. next*는 더 올라갈 구간이 없으면(최고 티어) null. */
    public record PlayerTierResponse(String key, String displayName, int minScore,
                                     String nextDisplayName, Integer nextMinScore) {
    }
}
