package com.srpfreaks.backend.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterTest {

    /** 시간을 마음대로 움직일 수 있는 시계. */
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-05T00:00:00Z");

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void 한도까지는_허용하고_넘으면_거부한다() {
        RateLimiter limiter = new RateLimiter(3, new MutableClock());

        assertThat(limiter.tryAcquire("1.1.1.1")).isTrue();
        assertThat(limiter.tryAcquire("1.1.1.1")).isTrue();
        assertThat(limiter.tryAcquire("1.1.1.1")).isTrue();
        assertThat(limiter.tryAcquire("1.1.1.1")).isFalse();
    }

    @Test
    void IP마다_따로_센다() {
        RateLimiter limiter = new RateLimiter(1, new MutableClock());

        assertThat(limiter.tryAcquire("1.1.1.1")).isTrue();
        assertThat(limiter.tryAcquire("1.1.1.1")).isFalse();
        assertThat(limiter.tryAcquire("2.2.2.2")).isTrue();
    }

    @Test
    void 일분이_지나면_다시_허용한다() {
        MutableClock clock = new MutableClock();
        RateLimiter limiter = new RateLimiter(1, clock);
        limiter.tryAcquire("1.1.1.1");
        assertThat(limiter.tryAcquire("1.1.1.1")).isFalse();

        clock.now = clock.now.plusSeconds(60);

        assertThat(limiter.tryAcquire("1.1.1.1")).isTrue();
    }
}
