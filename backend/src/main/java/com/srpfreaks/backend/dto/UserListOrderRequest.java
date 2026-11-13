package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/** 리스트 안 곡 순서 바꾸기 요청. 새 순서대로 채보 id를 나열한다(크기 상한은 서비스가 설정 list.max_items로 검사). */
public record UserListOrderRequest(@NotNull(message = "순서를 보내 주세요.") List<Long> songDifficultyIds) {
}
