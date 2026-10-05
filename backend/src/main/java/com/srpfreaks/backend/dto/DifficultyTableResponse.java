package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.TableStatus;

public record DifficultyTableResponse(Long id, String name, InstrumentPart instrumentPart, NoteOption noteOption,
                                      TableStatus status, int revision) {

    public static DifficultyTableResponse from(DifficultyTable t) {
        return new DifficultyTableResponse(t.getId(), t.getName(), t.getInstrumentPart(), t.getNoteOption(),
                t.getStatus(), t.getRevision());
    }
}
