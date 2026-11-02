package com.srpfreaks.backend.service;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TierNotifyConfigTest {

    private static Map<String, String> valid() {
        Map<String, String> m = new HashMap<>();
        m.put("tier.notify_keep_days", "30");
        m.put("tier.notify_bundle_over", "5");
        return m;
    }

    @Test
    void 기본값을_읽는다() {
        TierNotifyConfig config = TierNotifyConfig.from(valid());

        assertThat(config.keepDays()).isEqualTo(30);
        assertThat(config.bundleOver()).isEqualTo(5);
    }

    @Test
    void 없거나_정수가_아니거나_1_미만이면_예외() {
        Map<String, String> missing = valid();
        missing.remove("tier.notify_bundle_over");
        Map<String, String> text = valid();
        text.put("tier.notify_keep_days", "abc");
        Map<String, String> zero = valid();
        zero.put("tier.notify_bundle_over", "0");

        assertThatThrownBy(() -> TierNotifyConfig.from(missing)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> TierNotifyConfig.from(text)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> TierNotifyConfig.from(zero)).isInstanceOf(IllegalStateException.class);
    }
}
