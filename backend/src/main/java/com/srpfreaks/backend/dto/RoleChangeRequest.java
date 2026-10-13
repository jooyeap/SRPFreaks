package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Role;
import jakarta.validation.constraints.NotNull;

/** 역할 변경 요청. ROOT로 바꾸는 요청은 서비스가 거절한다(ROOT는 1명, 환경변수로만 만든다). */
public record RoleChangeRequest(@NotNull(message = "역할은 필수입니다.") Role role) {
}
