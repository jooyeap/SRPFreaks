package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.NoteOption;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RatingConfigTest {

    private static Map<String, String> valid() {
        Map<String, String> m = new HashMap<>();
        m.put("rating.pivot", "6.0");
        m.put("rating.high_slope", "5");
        m.put("rating.high_offset", "15");
        m.put("rating.low_slope", "10");
        m.put("rating.low_offset", "45");
        m.put("rating.cap_rate", "80");
        m.put("rating.max_rate", "95");
        m.put("rating.bonus", "3.2");
        m.put("rating.score_multiplier", "20");
        m.put("rating.list_single", "15");
        m.put("rating.list_other", "25");
        m.put("rating.note_option", "SUPER_RANDOM_PLUS");
        return m;
    }

    @Test
    void 설정_맵에서_값을_읽는다() {
        RatingConfig config = RatingConfig.from(valid());

        assertThat(config.pivot()).isEqualByComparingTo("6.0");
        assertThat(config.bonus()).isEqualByComparingTo("3.2");
        assertThat(config.listSingle()).isEqualTo(15);
        assertThat(config.listOther()).isEqualTo(25);
        assertThat(config.noteOption()).isEqualTo(NoteOption.SUPER_RANDOM_PLUS);
    }

    @Test
    void 설정이_없으면_기본값으로_넘어가지_않고_예외다() {
        Map<String, String> m = valid();
        m.remove("rating.bonus");

        assertThatThrownBy(() -> RatingConfig.from(m)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("rating.bonus");
    }

    @Test
    void 숫자가_아닌_설정은_예외다() {
        Map<String, String> m = valid();
        m.put("rating.list_single", "열다섯");

        assertThatThrownBy(() -> RatingConfig.from(m)).isInstanceOf(IllegalStateException.class);
        m.put("rating.list_single", "15");
        m.put("rating.pivot", "abc");
        assertThatThrownBy(() -> RatingConfig.from(m)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 알_수_없는_노트_옵션은_예외다() {
        Map<String, String> m = valid();
        m.put("rating.note_option", "NOPE");

        assertThatThrownBy(() -> RatingConfig.from(m)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void max_rate가_cap_rate_이하이면_예외다() {
        Map<String, String> m = valid();
        m.put("rating.max_rate", "80");

        assertThatThrownBy(() -> RatingConfig.from(m)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 목록_개수가_음수면_예외다() {
        Map<String, String> m = valid();
        m.put("rating.list_other", "-1");

        assertThatThrownBy(() -> RatingConfig.from(m)).isInstanceOf(IllegalStateException.class);
    }
}
