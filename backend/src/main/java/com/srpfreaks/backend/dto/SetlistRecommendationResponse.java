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
 * 범위(ssMin~sMax)는 평균 대비 차이이고, customRange가 true면 사용자가 직접 정한 값이다(false면 서버 기본값).
 * 두 묶음은 각각 따로 쪽을 넘긴다(ssPage / sPage, 묶음마다 size개). ssTotalPages·sTotalPages도 묶음별이다.
 */
public record SetlistRecommendationResponse(Status status, BigDecimal baseTier,
                                            BigDecimal ssMin, BigDecimal ssMax, BigDecimal sMin, BigDecimal sMax,
                                            boolean customRange,
                                            int ratedSingle, int ratedOther, int requiredSingle, int requiredOther,
                                            List<Item> ssChallenge, List<Item> sFill,
                                            int ssPage, int sPage, int size, int ssTotalPages, int sTotalPages) {

    public enum Status { READY, STARTER, INSUFFICIENT, UNAVAILABLE }

    /**
     * 추천 사유 코드(D89). PEER_TIER = 같은 티어대 공개 유저가 기준 인원 이상 레이팅에 반영한 곡, NEAR_AVERAGE = 내 평균 난이도 근처(근거 인원 없음).
     * STARTER에서는 사유를 달지 않는다(null).
     */
    public enum Reason { PEER_TIER, NEAR_AVERAGE }

    /**
     * 추천 한 줄. pattern은 서열표의 속성 글자(없으면 null). mine은 내 SRN+ 최고 기록(없으면 null).
     * peerUsers는 같은 티어대 공개 유저(나 제외) 중 이 채보를 레이팅에 반영한 인원이고, reason이 PEER_TIER일 때만 값이 있다(그 밖에는 null).
     * 인원 수만 내려가고 누가 반영했는지는 내려가지 않는다. 두 필드는 나중에 더한 것이라 기존 필드는 그대로다(호환).
     */
    public record Item(Long songDifficultyId, Long songId, String title, InstrumentPart part,
                       DifficultyType difficulty, BigDecimal level, BigDecimal tier, String pattern, MyRecord mine,
                       Integer peerUsers, Reason reason) {
    }
}
