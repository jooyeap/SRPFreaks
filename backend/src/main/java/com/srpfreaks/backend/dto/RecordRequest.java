package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Platform;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 옵션 기록 등록/수정 요청. 수정(PUT)은 보낸 값으로 통째로 교체한다(채보는 바꿀 수 없다. 잘못 골랐으면 삭제 후 다시 입력).
 * 달성률은 프론트(Zod) / 여기(Validation) / 엔티티 / DB(CHECK) 네 곳에서 모두 검사한다.
 * songDifficultyId는 등록에서만 쓰고 수정에서는 무시한다.
 */
public record RecordRequest(
        Long songDifficultyId,
        @NotNull(message = "노트 옵션은 필수입니다.") NoteOption noteOption,
        @NotNull(message = "달성률은 필수입니다.")
        @DecimalMin(value = "0.00", message = "달성률은 0.00 이상이어야 합니다.")
        @DecimalMax(value = "100.00", message = "달성률은 100.00 이하여야 합니다.")
        @Digits(integer = 3, fraction = 2, message = "달성률은 소수 둘째 자리까지만 입력할 수 있습니다.") BigDecimal achievementRate,
        boolean fullCombo,
        Instant playedAt,
        Platform platform,
        @Size(max = 255, message = "메모는 255자 이하여야 합니다.") String memo) {
}
