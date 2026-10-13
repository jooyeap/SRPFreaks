package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 서열표 만들기. instrumentPart를 비우면 기타·베이스 모두 다루는 표다. */
public record DifficultyTableRequest(
        @NotBlank(message = "표 이름은 필수입니다.")
        @Size(max = 100, message = "표 이름은 100자 이하여야 합니다.") String name,
        InstrumentPart instrumentPart,
        @NotNull(message = "기준 옵션은 필수입니다.") NoteOption noteOption) {
}
