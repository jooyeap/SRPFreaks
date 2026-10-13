package com.srpfreaks.backend.common.error;

/** 서비스/컨트롤러에서 의도적으로 던지는 오류. 응답 메시지는 ErrorCode의 고정 문구다. */
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
