package com.srpfreaks.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-10-05T00:00:00Z"), ZoneOffset.UTC);

    private MockHttpServletResponse call(RateLimitFilter filter, String uri) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        request.setRemoteAddr("9.9.9.9");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void 인증_경로는_한도를_넘으면_429와_공통_형식으로_응답한다() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimiter(1, clock), clock);

        assertThat(call(filter, "/api/v1/auth/google").getStatus()).isEqualTo(200);
        MockHttpServletResponse limited = call(filter, "/api/v1/auth/google");

        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat(limited.getContentAsString()).contains("RATE_LIMITED");
        assertThat(limited.getHeader("Retry-After")).isEqualTo("60");
    }

    @Test
    void 인증_경로가_아니면_제한하지_않는다() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimiter(1, clock), clock);

        for (int i = 0; i < 5; i++) {
            assertThat(call(filter, "/api/v1/users/me").getStatus()).isEqualTo(200);
        }
    }
}
