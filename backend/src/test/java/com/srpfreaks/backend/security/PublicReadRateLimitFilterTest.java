package com.srpfreaks.backend.security;

import com.srpfreaks.backend.entity.Role;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PublicReadRateLimitFilterTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-10-21T00:00:00Z"), ZoneOffset.UTC);

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletResponse call(PublicReadRateLimitFilter filter, String method, String uri) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRemoteAddr("9.9.9.9");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void 비로그인_공개_읽기는_한도를_넘으면_429와_공통_형식으로_응답한다() throws Exception {
        PublicReadRateLimitFilter filter = new PublicReadRateLimitFilter(new RateLimiter(2, clock), clock);

        assertThat(call(filter, "GET", "/api/v1/songs/charts").getStatus()).isEqualTo(200);
        assertThat(call(filter, "GET", "/api/v1/notices").getStatus()).isEqualTo(200);
        MockHttpServletResponse limited = call(filter, "GET", "/api/v1/players");

        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat(limited.getContentAsString()).contains("RATE_LIMITED");
        assertThat(limited.getHeader("Retry-After")).isEqualTo("60");
    }

    @Test
    void 로그인한_사용자는_제한하지_않는다() throws Exception {
        PublicReadRateLimitFilter filter = new PublicReadRateLimitFilter(new RateLimiter(1, clock), clock);
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                new AuthenticatedUser(1L, Role.USER), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        for (int i = 0; i < 5; i++) {
            assertThat(call(filter, "GET", "/api/v1/songs/charts").getStatus()).isEqualTo(200);
        }
    }

    @Test
    void 공개_읽기가_아닌_경로와_GET이_아닌_요청은_세지_않는다() throws Exception {
        PublicReadRateLimitFilter filter = new PublicReadRateLimitFilter(new RateLimiter(1, clock), clock);

        for (int i = 0; i < 5; i++) {
            assertThat(call(filter, "GET", "/api/v1/users/me").getStatus()).isEqualTo(200);
            assertThat(call(filter, "POST", "/api/v1/songs").getStatus()).isEqualTo(200);
        }
    }
}
