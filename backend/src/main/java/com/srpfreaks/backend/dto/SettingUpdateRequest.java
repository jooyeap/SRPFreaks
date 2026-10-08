package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 설정 값 변경 요청. 값의 의미(숫자, 참/거짓 등)는 키마다 달라서 서비스가 키별로 다시 검사한다. */
public record SettingUpdateRequest(
        @NotNull(message = "값은 필수입니다.")
        @Size(max = 500, message = "값은 500자 이하여야 합니다.") String value) {
}
