package com.srpfreaks.backend.security;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 쿠키로 동작하는 요청(재발급, 로그아웃)의 Origin 검사. SameSite=Strict에 더해 한 겹을 더 둔다.
 * 브라우저는 POST 요청에 Origin 헤더를 항상 붙이므로, 없거나 허용 목록에 없으면 거부한다.
 */
@Component
public class OriginPolicy {

    private final List<String> allowedOrigins;

    public OriginPolicy(AppProperties properties) {
        this.allowedOrigins = List.copyOf(properties.getCors().getAllowedOrigins());
    }

    public void requireAllowed(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin == null || !allowedOrigins.contains(origin)) {
            throw new ApiException(ErrorCode.ORIGIN_NOT_ALLOWED);
        }
    }
}
