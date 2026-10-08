package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

/**
 * 서열표 한 줄의 값 수정(ROOT·ADMIN). PUT이라 보낸 값으로 통째로 교체하므로 비워서 보내면 그 값이 지워진다.
 * tierLabel이 null이면 미정(레이팅에서 제외), recommend·pattern이 null이면 값 없음.
 * recommend·pattern은 응답(TableEntryResponse)과 같은 한글 값(상/중/하, 단일/복합/이중/삼중/레이팅 제외)으로 받는다.
 * 값이 틀리면 Bean Validation이 400으로 막으므로 서비스에서는 enum 변환이 실패하지 않는다.
 */
public record TableEntryUpdateRequest(
        @DecimalMin(value = "0.0", message = "기준 난이도는 0.0 이상이어야 합니다.")
        @DecimalMax(value = "99.9", message = "기준 난이도는 99.9 이하여야 합니다.")
        @Digits(integer = 2, fraction = 1, message = "기준 난이도는 소수 첫째 자리까지 입력할 수 있습니다.") BigDecimal tierLabel,
        @Pattern(regexp = "상|중|하", message = "추천도는 상, 중, 하 중 하나여야 합니다.") String recommend,
        @Pattern(regexp = "단일|복합|이중|삼중|레이팅 제외", message = "속성은 단일, 복합, 이중, 삼중, 레이팅 제외 중 하나여야 합니다.")
        String pattern) {
}
