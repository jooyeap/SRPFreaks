package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.util.List;

/**
 * 세트리스트 추천(D37). status가 화면의 분기를 정한다.
 * - READY        : baseTier = 내 평균 난이도. ssChallenge = baseTier + ssMin ~ ssMax 안에서 기록이 없거나 SS 미만인 채보(SS 기준),
 *                  sFill = baseTier + sMin ~ sMax 안에서 기록이 없거나 S 미만인 채보 중 SS 기준에 없는 것(S 기준).
 * - STARTER      : 레이팅 목록이 비어 있는 신규 사용자. baseTier = 입문 기준 난이도(starterTier)이고 sFill에만 그 이하의 채보가 들어 있다.
 * - INSUFFICIENT : 단일 / 그 외 채보가 모자라 평균을 믿기 어렵다. 목록은 비어 있고 ratedSingle·ratedOther와 requiredSingle·requiredOther 개수로 안내한다.
 * - UNAVAILABLE  : 레이팅 서열표가 없다.
 * 두 묶음은 같은 page / size(묶음마다 size개)로 넘기고, totalPages는 둘 중 긴 쪽 기준이다.
 */
public record SetlistRecommendationResponse(Status status, BigDecimal baseTier,
                                            BigDecimal ssMin, BigDecimal ssMax, BigDecimal sMin, BigDecimal sMax,
                                            int ratedSingle, int ratedOther, int requiredSingle, int requiredOther,
                                            List<Item> ssChallenge, List<Item> sFill,
                                            int page, int size, int totalPages) {

    public enum Status { READY, STARTER, INSUFFICIENT, UNAVAILABLE }

    /** 추천 한 줄. mine은 내 SRN+ 최고 기록(없으면 null). */
    public record Item(Long songDifficultyId, Long songId, String title, InstrumentPart part,
                       DifficultyType difficulty, BigDecimal level, BigDecimal tier, MyRecord mine) {
    }
}
