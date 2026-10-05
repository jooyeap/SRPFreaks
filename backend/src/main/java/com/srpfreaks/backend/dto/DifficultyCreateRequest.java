package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record DifficultyCreateRequest(
        @NotNull(message = "파트는 필수입니다.") InstrumentPart instrumentPart,
        @NotNull(message = "난이도 종류는 필수입니다.") DifficultyType difficultyType,
        @NotNull(message = "레벨은 필수입니다.")
        @DecimalMin(value = "0.00", message = "레벨은 0.00 이상이어야 합니다.")
        @DecimalMax(value = "9.99", message = "레벨은 9.99 이하여야 합니다.")
        @Digits(integer = 1, fraction = 2, message = "레벨은 소수 둘째 자리까지 입력할 수 있습니다.") BigDecimal level,
        @Min(value = 0, message = "노트 수는 0 이상이어야 합니다.") Integer noteCount) {
}
