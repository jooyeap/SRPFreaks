package com.srpfreaks.backend.dto;

import java.time.Instant;

/** 발급 직후 한 번만 내려가는 응답. 토큰 원문은 이 응답에만 있고 다시 조회할 수 없다. */
public record ImportTokenIssueResponse(String token, Instant createdAt) {
}
