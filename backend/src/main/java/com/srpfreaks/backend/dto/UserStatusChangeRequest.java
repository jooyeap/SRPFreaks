package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.UserStatus;
import jakarta.validation.constraints.NotNull;

/** 계정 상태 변경 요청(차단 BLOCKED / 차단 해제 ACTIVE). */
public record UserStatusChangeRequest(@NotNull(message = "상태는 필수입니다.") UserStatus status) {
}
