package com.srpfreaks.backend.security;

import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.common.error.JsonErrorWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;

/**
 * 로그인 없이 읽는 공개 경로(PublicReadPaths)에 IP별 요청 제한을 건다. 곡 목록을 통째로 긁어 가는 것을 늦추기 위해서다.
 * 로그인한 사용자는 제한하지 않는다(공용 Wi-Fi의 IP를 같이 쓰는 로그인 사용자가 막히지 않도록).
 * 그래서 JWT 필터 뒤에 둔다: 인증 결과를 본 다음에 "비로그인인가"를 판단해야 한다.
 * 가짜 Authorization 헤더를 붙여도 토큰이 검증되지 않으면 인증이 비어 있으므로 제한을 피할 수 없다.
 * IP는 RateLimitFilter와 같이 getRemoteAddr()만 쓴다(X-Forwarded-For를 직접 읽으면 위조로 피할 수 있다).
 */
public class PublicReadRateLimitFilter extends OncePerRequestFilter {

    private final RateLimiter rateLimiter;
    private final Clock clock;

    public PublicReadRateLimitFilter(RateLimiter rateLimiter, Clock clock) {
        this.rateLimiter = rateLimiter;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !PublicReadPaths.matches(request) || isLoggedIn();
    }

    private static boolean isLoggedIn() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
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
