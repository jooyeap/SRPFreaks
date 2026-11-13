package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;

/** `서열표 변경 알림 받기` 켜기/끄기(D61). */
public record TierNotifyRequest(@NotNull Boolean enabled) {
}
