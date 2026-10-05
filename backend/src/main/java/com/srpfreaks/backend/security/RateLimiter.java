package com.srpfreaks.backend.security;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 키(IP)별 고정 시간창(1분) 요청 제한. 서버 한 대 기준의 메모리 방식이다.
 * 서버를 여러 대로 늘리면 Redis 같은 공유 저장소로 바꿔야 한다(지금은 EC2 1대라 충분하다).
 * 맵이 무한히 커지지 않도록 일정 크기를 넘으면 만료된 항목을 청소한다.
 */
public class RateLimiter {

    private static final long WINDOW_SECONDS = 60;
    private static final int CLEANUP_THRESHOLD = 10_000;

    private record Window(long startEpochSecond, int count) {
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final int limitPerMinute;
    private final Clock clock;

    public RateLimiter(int limitPerMinute, Clock clock) {
        this.limitPerMinute = limitPerMinute;
        this.clock = clock;
    }

    /** 요청 1건을 센다. 허용되면 true, 한도를 넘으면 false. */
    public boolean tryAcquire(String key) {
        long now = Instant.now(clock).getEpochSecond();
        if (windows.size() > CLEANUP_THRESHOLD) {
            windows.entrySet().removeIf(e -> now - e.getValue().startEpochSecond() >= WINDOW_SECONDS);
        }
        // compute는 키 단위로 원자적이라 동시에 들어와도 카운트가 어긋나지 않는다
        Window updated = windows.compute(key, (k, w) -> {
            if (w == null || now - w.startEpochSecond() >= WINDOW_SECONDS) {
                return new Window(now, 1);
            }
            return new Window(w.startEpochSecond(), w.count() + 1);
        });
        return updated.count() <= limitPerMinute;
    }
}
