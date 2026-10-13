package com.srpfreaks.backend.dto;

import java.time.Instant;

/** 내 가져오기 토큰 상태. 원문은 내보내지 않는다(발급 여부와 시각만). 토큰이 없으면 exists=false이고 시각은 null이다. */
public record ImportTokenStatusResponse(boolean exists, Instant createdAt, Instant lastUsedAt) {

    public static ImportTokenStatusResponse none() {
        return new ImportTokenStatusResponse(false, null, null);
    }
}
