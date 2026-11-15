package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.mapper.RivalBundleSongRow;

import java.math.BigDecimal;

/** 라이벌 묶음 알림의 곡 한 줄(D86). 차이(상대 − 나)는 화면에서 계산한다. */
public record RivalBundleSongResponse(Long songDifficultyId, String title, InstrumentPart part, DifficultyType difficulty,
                                      BigDecimal actorRate, BigDecimal myRate) {

    public static RivalBundleSongResponse from(RivalBundleSongRow row) {
        return new RivalBundleSongResponse(row.songDifficultyId(), row.title(), InstrumentPart.valueOf(row.part()),
                DifficultyType.valueOf(row.difficulty()), row.actorRate(), row.myRate());
    }
}
