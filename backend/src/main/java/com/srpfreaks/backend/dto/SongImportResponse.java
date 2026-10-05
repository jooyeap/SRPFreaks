package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.util.List;

/**
 * CSV 일괄 등록 결과. 미리보기(confirm=false)와 저장(confirm=true)이 같은 형식이다.
 * 개수는 미리보기에서는 "저장하면 이렇게 된다", 저장 후에는 "이렇게 되었다"는 뜻이다.
 * applied는 실제로 DB에 반영했는지다(오류 행이 있으면 저장하지 않는다).
 */
public record SongImportResponse(
        boolean applied,
        int totalRows,
        int newSongs,
        int updatedSongs,
        int newDifficulties,
        int unchangedDifficulties,
        int skippedDeleted,
        int levelChangeCount,
        List<LevelChange> levelChanges,
        int errorCount,
        List<RowError> errors) {

    /** 레벨이 바뀐 채보("레벨 변경 후보"). 목록은 일부만 보여준다. */
    public record LevelChange(String title, InstrumentPart part, DifficultyType difficultyType,
                              BigDecimal before, BigDecimal after) {
    }

    public record RowError(int line, String message) {
    }
}
