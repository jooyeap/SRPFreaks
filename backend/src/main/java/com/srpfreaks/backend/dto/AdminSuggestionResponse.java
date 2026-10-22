package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Suggestion;
import com.srpfreaks.backend.entity.SuggestionCategory;
import com.srpfreaks.backend.entity.SuggestionStatus;

import java.time.Instant;

/** 관리자 목록용 응답. 보낸 사람은 닉네임만 내보낸다(이메일·Google ID는 내보내지 않는다). */
public record AdminSuggestionResponse(Long id, SuggestionCategory category, String title, String content,
                                      InstrumentPart requestedPart, DifficultyType requestedDifficulty,
                                      SuggestionStatus status, String adminNote, String authorNickname,
                                      Instant createdAt, Instant updatedAt) {

    public static AdminSuggestionResponse from(Suggestion s) {
        return new AdminSuggestionResponse(s.getId(), s.getCategory(), s.getTitle(), s.getContent(),
                s.getRequestedPart(), s.getRequestedDifficulty(), s.getStatus(), s.getAdminNote(), s.getUser().getNickname(), s.getCreatedAt(), s.getUpdatedAt());
    }
}
