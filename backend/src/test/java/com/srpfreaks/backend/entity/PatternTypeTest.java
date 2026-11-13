package com.srpfreaks.backend.entity;

import com.srpfreaks.backend.entity.PatternType.RatingGroup;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 속성별 레이팅 그룹(D62)과 한글 라벨. */
class PatternTypeTest {

    @Test
    void 그룹은_한_메서드로_정한다() {
        assertThat(PatternType.SINGLE.ratingGroup()).isEqualTo(RatingGroup.SINGLE);
        assertThat(PatternType.COMPOUND.ratingGroup()).isEqualTo(RatingGroup.OTHER);
        assertThat(PatternType.DOUBLE.ratingGroup()).isEqualTo(RatingGroup.OTHER);
        assertThat(PatternType.TRIPLE.ratingGroup()).isEqualTo(RatingGroup.OTHER);
        assertThat(PatternType.COMPOSITE_SINGLE.ratingGroup()).isEqualTo(RatingGroup.OTHER);
        assertThat(PatternType.EXCLUDED.ratingGroup()).isEqualTo(RatingGroup.NONE);
    }

    @Test
    void 속성이_없으면_어느_그룹에도_넣지_않는다() {
        assertThat(PatternType.ratingGroupOf(null)).isEqualTo(RatingGroup.NONE);
        assertThat(PatternType.ratingGroupOf(PatternType.COMPOSITE_SINGLE)).isEqualTo(RatingGroup.OTHER);
    }

    @Test
    void 복합단일의_라벨은_괄호_포함_글자_그대로이고_변환기로_오간다() {
        PatternType.DbConverter converter = new PatternType.DbConverter();
        assertThat(PatternType.COMPOSITE_SINGLE.getLabel()).isEqualTo("복합(단일)");
        assertThat(converter.convertToDatabaseColumn(PatternType.COMPOSITE_SINGLE)).isEqualTo("복합(단일)");
        assertThat(converter.convertToEntityAttribute("복합(단일)")).isEqualTo(PatternType.COMPOSITE_SINGLE);
    }
}
