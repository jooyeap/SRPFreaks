package com.srpfreaks.backend.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SetlistRecommendConfigTest {

    private static Map<String, String> settings(String ss, String s, String min) {
        return Map.of("setlist.recommend_range_ss", ss, "setlist.recommend_range_s", s, "setlist.recommend_min_entries", min);
    }

    @Test
    void 설정_값을_읽는다() {
        SetlistRecommendConfig config = SetlistRecommendConfig.from(settings("0.3", "0.5", "10"));

        assertThat(config.rangeSs()).isEqualByComparingTo("0.3");
        assertThat(config.rangeS()).isEqualByComparingTo("0.5");
        assertThat(config.minEntries()).isEqualTo(10);
    }

    @Test
    void S_범위가_SS_범위와_같아도_된다() {
        assertThat(SetlistRecommendConfig.from(settings("0.4", "0.4", "1")).rangeS()).isEqualByComparingTo("0.4");
    }

    @Test
    void 설정이_없으면_예외로_알린다() {
        assertThatThrownBy(() -> SetlistRecommendConfig.from(Map.of()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("setlist.recommend_range_ss");
    }

    @Test
    void 숫자가_아니면_예외() {
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("abc", "0.5", "10")))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("0.3", "0.5", "열")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 범위와_최소_개수_규칙을_지킨다() {
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("0", "0.5", "10"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("-0.1", "0.5", "10"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("0.5", "0.3", "10")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("이상");
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("0.3", "0.5", "0"))).isInstanceOf(IllegalStateException.class);
    }
}
