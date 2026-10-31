package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;

/** `라이벌 알림 받기` 켜기/끄기(D56). */
public record RivalNotifyRequest(@NotNull Boolean enabled) {
}
