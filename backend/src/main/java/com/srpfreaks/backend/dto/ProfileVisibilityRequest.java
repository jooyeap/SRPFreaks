package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 유저 목록 공개 여부 변경 요청. 값이 빠지면(null) 거부한다.
 * 닉네임 변경(PATCH /users/me)과 따로 둔 이유: 그 요청은 닉네임이 비면 "닉네임 삭제"라서, 공개 값만 보내면
 * 닉네임이 지워지는 사고가 날 수 있다. 서로 다른 필드를 하나의 PATCH에 섞지 않는다.
 */
public record ProfileVisibilityRequest(
        @NotNull(message = "공개 여부를 선택해 주세요.")
        Boolean profilePublic) {
}
