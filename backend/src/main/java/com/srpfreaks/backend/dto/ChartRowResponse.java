package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.SongDifficulty;

import java.math.BigDecimal;

/**
 * 곡 목록·검색 결과의 채보 한 줄. mine은 내 SRN+ 최고 기록(없으면 null, 비로그인도 null).
 * artist·bpm은 곡 마스터, tier·patternType·ratingConstant는 서열표(SRN+ 활성 표) 값이라 모두 공개 정보다(D106).
 * 서열표에 없거나 기준 난이도가 미정이면 tier·ratingConstant는 null, 속성이 비어 있으면 patternType은 null이다. patternType은 서열표와 같은 한글 라벨(단일/복합/...)이다.
 */
public record ChartRowResponse(Long songDifficultyId, Long songId, String title, String addedVersion,
                               InstrumentPart part, DifficultyType difficulty, BigDecimal level, MyRecord mine,
                               String artist, Integer bpmMin, Integer bpmMax,
                               BigDecimal tier, BigDecimal ratingConstant, String patternType) {

    public static ChartRowResponse of(SongDifficulty d, MyRecord mine, BigDecimal tier, BigDecimal ratingConstant,
                                      PatternType pattern) {
        return new ChartRowResponse(d.getId(), d.getSong().getId(), d.getSong().getTitle(),
                d.getSong().getAddedVersion(), d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(), mine,
                d.getSong().getArtist(), d.getSong().getBpmMin(), d.getSong().getBpmMax(),
                tier, ratingConstant, pattern == null ? null : pattern.getLabel());
    }
}
