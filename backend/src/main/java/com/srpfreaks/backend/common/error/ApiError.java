package com.srpfreaks.backend.common.error;

import java.time.Instant;
import java.util.Map;

/**
 * 모든 오류 응답의 공통 형식.
 * fieldErrors는 입력 검증 실패 때만 채워지고, 키는 필드 이름, 값은 우리가 정한 검증 문구다(입력값 자체는 담지 않는다).
 */
public record ApiError(String code, String message, Instant timestamp, Map<String, String> fieldErrors) {

    public static ApiError of(ErrorCode errorCode, Instant now) {
        return new ApiError(errorCode.name(), errorCode.getMessage(), now, null);
    }

    public static ApiError of(ErrorCode errorCode, Instant now, Map<String, String> fieldErrors) {
        return new ApiError(errorCode.name(), errorCode.getMessage(), now, fieldErrors);
    }
}
