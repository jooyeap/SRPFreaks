package com.srpfreaks.backend.security;

import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.common.error.JsonErrorWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;

/**
 * 로그인/재발급/로그아웃(/api/v1/auth/**)에 IP별 요청 제한을 건다. 무차별 대입과 토큰 추측을 늦추기 위해서다.
 * 인증보다 앞에서 동작해야 하므로 보안 필터 체인의 맨 앞에 둔다.
 * IP는 request.getRemoteAddr()만 쓴다. X-Forwarded-For를 직접 읽으면 헤더를 위조해 제한을 피할 수 있어서,
 * 프록시 뒤에서는 server.forward-headers-strategy(native)가 신뢰된 프록시일 때만 주소를 바꿔 준다.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String AUTH_PATH_PREFIX = "/api/v1/auth/";

    private final RateLimiter rateLimiter;
    private final Clock clock;
    private final String pathPrefix;

    /** 로그인/재발급/로그아웃(/api/v1/auth/) 제한. */
    public RateLimitFilter(RateLimiter rateLimiter, Clock clock) {
        this(rateLimiter, clock, AUTH_PATH_PREFIX);
    }

    /** 다른 경로(예: 가져오기)에 따로 제한을 건다. 제한기를 따로 받으므로 로그인 제한과 횟수가 섞이지 않는다. */
    public RateLimitFilter(RateLimiter rateLimiter, Clock clock, String pathPrefix) {
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.pathPrefix = pathPrefix;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(pathPrefix);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!rateLimiter.tryAcquire(request.getRemoteAddr())) {
            response.setHeader("Retry-After", "60");
            JsonErrorWriter.write(response, ErrorCode.RATE_LIMITED, clock.instant());
            return;
        }
        chain.doFilter(request, response);
    }
}
