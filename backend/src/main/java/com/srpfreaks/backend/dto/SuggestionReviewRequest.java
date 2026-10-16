package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Suggestion;
import com.srpfreaks.backend.entity.SuggestionStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 관리자의 처리 요청: 상태는 필수, 답변은 선택. */
public record SuggestionReviewRequest(
        @NotNull(message = "상태를 선택해 주세요.") SuggestionStatus status,
        @Size(max = Suggestion.ADMIN_NOTE_MAX_LENGTH, message = "답변은 500자 이하여야 합니다.") String adminNote) {
}
