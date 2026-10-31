package com.srpfreaks.backend.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RivalConfigTest {

    private static Map<String, String> settings(String max) {
        return Map.of("rival.max_count", max, "rival.notify_delay_minutes", "10",
                "rival.notify_daily_per_rival", "3", "rival.notify_keep_days", "30");
    }

    @Test
    void 설정을_읽는다() {
        RivalConfig config = RivalConfig.from(settings("5"));
        assertThat(config).isEqualTo(new RivalConfig(5, 10, 3, 30));
    }

    @Test
    void 비었거나_정수가_아니거나_1_미만이면_예외다() {
        assertThatThrownBy(() -> RivalConfig.from(settings("0"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> RivalConfig.from(settings("a"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> RivalConfig.from(Map.of())).isInstanceOf(IllegalStateException.class);
    }
}
