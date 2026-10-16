package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Suggestion;
import com.srpfreaks.backend.entity.SuggestionCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 건의 보내기 요청. 앞뒤 공백은 엔티티가 잘라 내므로 여기서는 비었는지와 길이만 본다. */
public record SuggestionRequest(
        @NotNull(message = "종류를 선택해 주세요.") SuggestionCategory category,
        @NotBlank(message = "제목을 입력해 주세요.")
        @Size(max = Suggestion.TITLE_MAX_LENGTH, message = "제목은 100자 이하여야 합니다.") String title,
        @NotBlank(message = "내용을 입력해 주세요.")
        @Size(max = Suggestion.CONTENT_MAX_LENGTH, message = "내용은 2000자 이하여야 합니다.") String content) {
}
