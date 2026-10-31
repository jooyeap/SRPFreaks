package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** 라이벌 등록(D56). 등록하는 사람은 토큰에서만 정한다. */
public record RivalRequest(@NotNull @Positive Long targetUserId) {
}
