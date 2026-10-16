package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;

/** 세트리스트에 채보 담기 요청. */
public record SetlistAddRequest(@NotNull(message = "채보를 선택해 주세요.") Long songDifficultyId) {
}
