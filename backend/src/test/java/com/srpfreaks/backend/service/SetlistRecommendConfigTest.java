package com.srpfreaks.backend.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SetlistRecommendConfigTest {

    private static Map<String, String> settings(String ssMin, String ssMax, String sMin, String sMax, String minSingle, String minOther, String starter) {
        return Map.of(
                "setlist.recommend_ss_min", ssMin, "setlist.recommend_ss_max", ssMax,
                "setlist.recommend_s_min", sMin, "setlist.recommend_s_max", sMax,
                "setlist.recommend_min_single", minSingle, "setlist.recommend_min_other", minOther,
                "setlist.recommend_starter_tier", starter);
    }

    private static Map<String, String> defaults() {
        return settings("-0.6", "-0.1", "-0.1", "0.4", "5", "9", "5.2");
    }

    @Test
    void 설정_값을_읽는다() {
        SetlistRecommendConfig config = SetlistRecommendConfig.from(defaults());

        assertThat(config.ssMin()).isEqualByComparingTo("-0.6");
        assertThat(config.ssMax()).isEqualByComparingTo("-0.1");
        assertThat(config.sMin()).isEqualByComparingTo("-0.1");
        assertThat(config.sMax()).isEqualByComparingTo("0.4");
        assertThat(config.minSingle()).isEqualTo(5);
        assertThat(config.minOther()).isEqualTo(9);
        assertThat(config.starterTier()).isEqualByComparingTo("5.2");
    }

    @Test
    void 하한과_상한이_같아도_된다() {
        assertThat(SetlistRecommendConfig.from(settings("-0.3", "-0.3", "0", "0", "1", "1", "5")).ssMin()).isEqualByComparingTo("-0.3");
    }

    @Test
    void 설정이_없으면_예외로_알린다() {
        assertThatThrownBy(() -> SetlistRecommendConfig.from(Map.of()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("setlist.recommend_ss_min");
    }

    @Test
    void 숫자가_아니면_예외() {
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("abc", "-0.1", "-0.1", "0.4", "5", "9", "5.2")))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("-0.6", "-0.1", "-0.1", "0.4", "다섯", "9", "5.2")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 범위_최소_개수_입문_난이도_규칙을_지킨다() {
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("0", "-0.1", "-0.1", "0.4", "5", "9", "5.2")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("ss_min");
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("-0.6", "-0.1", "0.5", "0.4", "5", "9", "5.2")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("s_min");
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("-0.6", "-0.1", "-0.1", "0.4", "0", "9", "5.2")))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("-0.6", "-0.1", "-0.1", "0.4", "5", "0", "5.2")))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SetlistRecommendConfig.from(settings("-0.6", "-0.1", "-0.1", "0.4", "5", "9", "0")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("starter_tier");
    }
}
