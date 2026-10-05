package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.SongDifficulty;

import java.math.BigDecimal;

public record DifficultyResponse(Long id, Long songId, InstrumentPart instrumentPart, DifficultyType difficultyType,
                                 BigDecimal level, Integer noteCount) {

    public static DifficultyResponse from(SongDifficulty d) {
        // song은 LAZY 프록시라 id만 읽으면 추가 쿼리가 나가지 않는다
        return new DifficultyResponse(d.getId(), d.getSong().getId(), d.getInstrumentPart(), d.getDifficultyType(),
                d.getLevel(), d.getNoteCount());
    }
}
