package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Suggestion;
import com.srpfreaks.backend.entity.SuggestionCategory;
import com.srpfreaks.backend.entity.SuggestionStatus;

import java.time.Instant;

/** 내 건의 응답. 본인 것만 나가므로 쓴 사람 정보는 담지 않는다. 시각은 UTC. */
public record SuggestionResponse(Long id, SuggestionCategory category, String title, String content,
                                 InstrumentPart requestedPart, DifficultyType requestedDifficulty,
                                 SuggestionStatus status, String adminNote, Instant createdAt, Instant updatedAt) {

    public static SuggestionResponse from(Suggestion s) {
        return new SuggestionResponse(s.getId(), s.getCategory(), s.getTitle(), s.getContent(),
                s.getRequestedPart(), s.getRequestedDifficulty(), s.getStatus(), s.getAdminNote(), s.getCreatedAt(), s.getUpdatedAt());
    }
}
