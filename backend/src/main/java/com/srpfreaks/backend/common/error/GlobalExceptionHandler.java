package com.srpfreaks.backend.common.error;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 모든 예외를 공통 형식(ApiError)으로 바꾼다.
 * ResponseEntityExceptionHandler를 상속하면 스프링 MVC가 던지는 표준 예외(본문 파싱 실패, 404, 405, 415 등)도
 * 여기서 한꺼번에 우리 형식으로 처리된다. 상속하지 않고 Exception을 잡으면 404가 500으로 바뀌는 문제가 생긴다.
 * 예외의 상세 메시지, 스택트레이스, SQL은 로그에만 남기고 응답에는 넣지 않는다.
 */
@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private final Clock clock;

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApi(ApiException e) {
        return body(e.getErrorCode());
    }

    // @PreAuthorize가 컨트롤러 안에서 던지는 예외는 ExceptionTranslationFilter까지 가기 전에 여기서 잡히므로 직접 처리한다.
    // (아래 Exception 핸들러가 삼켜서 500으로 응답하는 것을 막는다)
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException e) {
        return body(ErrorCode.FORBIDDEN);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException e) {
        return body(ErrorCode.UNAUTHORIZED);
    }

    // 엔티티가 던지는 입력 검증 예외. 라이브러리 내부 메시지가 섞일 수 있어 내용은 응답하지 않고 일반 문구만 준다.
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("잘못된 입력: {}", e.getMessage());
        return body(ErrorCode.VALIDATION_ERROR);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception e) {
        log.error("처리되지 않은 예외", e);
        return body(ErrorCode.INTERNAL_ERROR);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        ApiError error = ApiError.of(ErrorCode.VALIDATION_ERROR, Instant.now(clock), fieldErrors);
        return ResponseEntity.status(ErrorCode.VALIDATION_ERROR.getStatus()).headers(headers).body(error);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
            HttpStatusCode statusCode, WebRequest request) {
        ErrorCode code = ErrorCode.fromStatus(statusCode.value());
        return ResponseEntity.status(statusCode).headers(headers).body(ApiError.of(code, Instant.now(clock)));
    }

    private ResponseEntity<ApiError> body(ErrorCode code) {
        return ResponseEntity.status(code.getStatus()).body(ApiError.of(code, Instant.now(clock)));
    }
}
