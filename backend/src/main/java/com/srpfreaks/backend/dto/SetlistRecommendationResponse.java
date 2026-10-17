package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.util.List;

/**
 * 세트리스트 추천(D37). baseTier = 내 평균 난이도(서열표 기준 난이도 T)이고, 추정할 근거가 모자라면 null(목록도 비어 있다).
 * ssChallenge = baseTier ± rangeSs 안에서 기록이 없거나 SS 미만인 채보(SS 도전),
 * sFill = baseTier ± rangeS 안에서 기록이 없거나 S 미만인 채보 중 SS 도전에 없는 것(S 채우기).
 * 두 묶음은 같은 page / size(묶음마다 size개)로 넘기고, totalPages는 둘 중 긴 쪽 기준이다.
 */
public record SetlistRecommendationResponse(BigDecimal baseTier, BigDecimal rangeSs, BigDecimal rangeS,
                                            List<Item> ssChallenge, List<Item> sFill,
                                            int page, int size, int totalPages) {

    /** 추천 한 줄. mine은 내 SRN+ 최고 기록(없으면 null). */
    public record Item(Long songDifficultyId, Long songId, String title, InstrumentPart part,
                       DifficultyType difficulty, BigDecimal level, BigDecimal tier, MyRecord mine) {
    }

    /** 추정할 근거가 모자라거나 레이팅 서열표가 없을 때의 빈 응답. */
    public static SetlistRecommendationResponse unavailable(BigDecimal rangeSs, BigDecimal rangeS, int page, int size) {
        return new SetlistRecommendationResponse(null, rangeSs, rangeS, List.of(), List.of(), page, size, 0);
    }
}
