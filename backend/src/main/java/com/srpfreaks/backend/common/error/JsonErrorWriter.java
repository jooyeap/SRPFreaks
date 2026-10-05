package com.srpfreaks.backend.common.error;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * 필터와 보안 핸들러(401/403/429)는 컨트롤러 밖이라 GlobalExceptionHandler가 닿지 않는다.
 * 같은 형식(ApiError)의 JSON을 직접 써 준다. 내용은 ErrorCode의 고정 문구뿐이라 문자열 이스케이프 걱정이 없다.
 */
public final class JsonErrorWriter {

    private JsonErrorWriter() {
    }

    public static void write(HttpServletResponse response, ErrorCode code, Instant now) throws IOException {
        response.setStatus(code.getStatus().value());
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String json = "{\"code\":\"" + code.name() + "\",\"message\":\"" + code.getMessage()
                + "\",\"timestamp\":\"" + now + "\",\"fieldErrors\":null}";
        response.getWriter().write(json);
    }
}
