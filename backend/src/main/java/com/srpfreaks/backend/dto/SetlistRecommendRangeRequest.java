package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 추천 범위 직접 설정 요청 (D37). 값은 내 평균 난이도 대비 차이(음수 = 더 쉬운 곡).
 * 항목별 형식은 여기서, 하한 <= 상한 같은 항목 사이의 규칙은 서비스에서 검사한다.
 */
public record SetlistRecommendRangeRequest(
        @NotNull(message = "SS 기준 하위 값을 입력해 주세요.")
        @DecimalMin(value = "-3.00", message = "값은 -3.00 이상이어야 합니다.")
        @DecimalMax(value = "3.00", message = "값은 3.00 이하여야 합니다.")
        @Digits(integer = 1, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal ssMin,
        @NotNull(message = "SS 기준 상위 값을 입력해 주세요.")
        @DecimalMin(value = "-3.00", message = "값은 -3.00 이상이어야 합니다.")
        @DecimalMax(value = "3.00", message = "값은 3.00 이하여야 합니다.")
        @Digits(integer = 1, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal ssMax,
        @NotNull(message = "S 기준 하위 값을 입력해 주세요.")
        @DecimalMin(value = "-3.00", message = "값은 -3.00 이상이어야 합니다.")
        @DecimalMax(value = "3.00", message = "값은 3.00 이하여야 합니다.")
        @Digits(integer = 1, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal sMin,
        @NotNull(message = "S 기준 상위 값을 입력해 주세요.")
        @DecimalMin(value = "-3.00", message = "값은 -3.00 이상이어야 합니다.")
        @DecimalMax(value = "3.00", message = "값은 3.00 이하여야 합니다.")
        @Digits(integer = 1, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal sMax) {
}
