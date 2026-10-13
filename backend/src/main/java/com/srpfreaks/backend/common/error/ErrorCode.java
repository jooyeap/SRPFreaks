package com.srpfreaks.backend.common.error;

import org.springframework.http.HttpStatus;

/**
 * API 오류 종류. 사용자에게 보이는 메시지는 여기 고정된 문구만 쓴다.
 * 내부 예외 메시지, 스택트레이스, SQL은 응답에 절대 넣지 않는다.
 */
public enum ErrorCode {

    /** 구글 토큰 검증 실패, 차단된 계정, 만료·재사용된 refresh 토큰 등을 모두 이 하나로 응답한다 (이유를 알려 주지 않는다). */
    AUTH_FAILED(HttpStatus.UNAUTHORIZED, "로그인할 수 없습니다. 다시 로그인해 주세요."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    ORIGIN_NOT_ALLOWED(HttpStatus.FORBIDDEN, "허용되지 않은 요청입니다."),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "요청 값을 확인해 주세요."),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "잘못된 요청입니다."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "찾을 수 없습니다."),
    CONFLICT(HttpStatus.CONFLICT, "이미 등록되어 있습니다."),
    SNAPSHOT_ALREADY_TODAY(HttpStatus.CONFLICT, "오늘은 이미 기록했습니다. 내일 다시 기록해 주세요."),
    SNAPSHOT_NO_CHANGE(HttpStatus.CONFLICT, "마지막 기록과 점수가 같아 기록할 수 없습니다."),
    SNAPSHOT_NO_RECORDS(HttpStatus.CONFLICT, "레이팅에 들어간 기록이 없어 기록할 수 없습니다."),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.");

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getMessage() {
        return message;
    }

    /** 스프링 MVC가 던지는 표준 예외(404, 405, 415 등)를 우리 형식으로 바꿀 때 상태 코드로 종류를 정한다. */
    public static ErrorCode fromStatus(int status) {
        if (status == 404) {
            return NOT_FOUND;
        }
        if (status >= 400 && status < 500) {
            return BAD_REQUEST;
        }
        return INTERNAL_ERROR;
    }
}
