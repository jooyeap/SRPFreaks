package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** DB에 한글 값(상/중/하, 단일/복합/...)으로 저장하는 변환기. */
class LabeledEnumTest {

    private final Recommend.DbConverter recommend = new Recommend.DbConverter();
    private final PatternType.DbConverter pattern = new PatternType.DbConverter();

    @Test
    void 추천도는_한글로_저장하고_다시_읽는다() {
        assertThat(recommend.convertToDatabaseColumn(Recommend.HIGH)).isEqualTo("상");
        assertThat(recommend.convertToDatabaseColumn(Recommend.MIDDLE)).isEqualTo("중");
        assertThat(recommend.convertToDatabaseColumn(Recommend.LOW)).isEqualTo("하");
        assertThat(recommend.convertToEntityAttribute("중")).isEqualTo(Recommend.MIDDLE);
    }

    @Test
    void 속성은_한글로_저장하고_다시_읽는다() {
        for (PatternType type : PatternType.values()) {
            String db = pattern.convertToDatabaseColumn(type);
            assertThat(pattern.convertToEntityAttribute(db)).isEqualTo(type);
        }
        assertThat(pattern.convertToDatabaseColumn(PatternType.EXCLUDED)).isEqualTo("레이팅 제외");
    }

    @Test
    void null은_null로_바꾼다() {
        assertThat(recommend.convertToDatabaseColumn(null)).isNull();
        assertThat(recommend.convertToEntityAttribute(null)).isNull();
        assertThat(pattern.convertToDatabaseColumn(null)).isNull();
        assertThat(pattern.convertToEntityAttribute(null)).isNull();
    }

    @Test
    void 모르는_값은_거부한다() {
        assertThatThrownBy(() -> recommend.convertToEntityAttribute("최상"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> pattern.convertToEntityAttribute("???"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
