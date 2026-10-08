package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.SongDifficulty;

import java.math.BigDecimal;

/** 곡 목록의 채보 한 줄. 전체 곡 목록에는 속성을 보이지 않으므로(DESIGN-UI 9장) 서열표 값은 담지 않는다. mine은 내 SRN+ 최고 기록(없으면 null). */
public record ChartRowResponse(Long songDifficultyId, Long songId, String title, String addedVersion,
                               InstrumentPart part, DifficultyType difficulty, BigDecimal level, MyRecord mine) {

    public static ChartRowResponse of(SongDifficulty d, MyRecord mine) {
        return new ChartRowResponse(d.getId(), d.getSong().getId(), d.getSong().getTitle(),
                d.getSong().getAddedVersion(), d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(), mine);
    }
}
