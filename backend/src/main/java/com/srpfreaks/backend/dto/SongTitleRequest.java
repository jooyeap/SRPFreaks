package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.TitleKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SongTitleRequest(
        @NotNull(message = "표기 종류는 필수입니다.") TitleKind kind,
        @NotBlank(message = "곡명 표기는 필수입니다.")
        @Size(max = 255, message = "곡명 표기는 255자 이하여야 합니다.") String title) {
}
