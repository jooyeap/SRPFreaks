package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 리스트 이름(만들기·이름 바꾸기). 길이·공백 검사는 서비스가 NFKC·앞뒤 공백 제거 뒤에 한다(예: 전각 공백만 있는 이름도 걸러야 해서).
 * 여기서는 값이 있는지만 본다.
 */
public record UserListNameRequest(@NotNull(message = "이름을 입력해 주세요.") String name) {
}
