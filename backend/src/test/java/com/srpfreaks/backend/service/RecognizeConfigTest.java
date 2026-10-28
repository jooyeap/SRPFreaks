package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.Role;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RecognizeConfigTest {

    private static Map<String, String> settings(String enabled, String role, String weekly, String daily) {
        Map<String, String> m = new HashMap<>();
        m.put("recognize.enabled", enabled);
        m.put("recognize.min_role", role);
        m.put("recognize.weekly_limit", weekly);
        m.put("recognize.daily_total_limit", daily);
        return m;
    }

    @Test
    void 기본값을_읽는다() {
        RecognizeConfig c = RecognizeConfig.from(settings("false", "ADMIN", "30", "300"));
        assertThat(c.enabled()).isFalse();
        assertThat(c.minRole()).isEqualTo(Role.ADMIN);
        assertThat(c.weeklyLimit()).isEqualTo(30);
        assertThat(c.dailyTotalLimit()).isEqualTo(300);
    }

    @Test
    void 시험_기간_ADMIN이면_ROOT와_ADMIN만_쓴다() {
        RecognizeConfig c = RecognizeConfig.from(settings("true", "ADMIN", "30", "300"));
        assertThat(c.allows(Role.ROOT)).isTrue();
        assertThat(c.allows(Role.ADMIN)).isTrue();
        assertThat(c.allows(Role.USER)).isFalse();
    }

    @Test
    void USER로_바꾸면_모두_쓴다() {
        RecognizeConfig c = RecognizeConfig.from(settings("true", "USER", "30", "300"));
        assertThat(c.allows(Role.USER)).isTrue();
        assertThat(c.allows(Role.ROOT)).isTrue();
    }

    @Test
    void 잘못된_값은_거절한다() {
        assertThatThrownBy(() -> RecognizeConfig.from(settings("yes", "ADMIN", "30", "300"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> RecognizeConfig.from(settings("true", "ROOT", "30", "300"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> RecognizeConfig.from(settings("true", "GUEST", "30", "300"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> RecognizeConfig.from(settings("true", "ADMIN", "0", "300"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> RecognizeConfig.from(settings("true", "ADMIN", "30", "x"))).isInstanceOf(IllegalStateException.class);
        Map<String, String> missing = settings("true", "ADMIN", "30", "300");
        missing.remove("recognize.weekly_limit");
        assertThatThrownBy(() -> RecognizeConfig.from(missing)).isInstanceOf(IllegalStateException.class);
    }
}
