package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 레이팅 대상 판단: 스위치가 켜져 있고, 기준 난이도와 속성이 모두 있고 '레이팅 제외'가 아닌 채보만. */
class DifficultyTableEntryTest {

    private DifficultyTableEntry entry;

    @BeforeEach
    void setUp() {
        DifficultyTable table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        Song song = Song.create("Sample", "Artist", "test", null);
        SongDifficulty difficulty = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        entry = DifficultyTableEntry.create(table, difficulty);
    }

    @Test
    void 새_줄은_레이팅_반영이_꺼진_상태로_시작한다() {
        entry.changeTier(new BigDecimal("6.0"), false, 1);
        entry.changePattern(PatternType.SINGLE, false);

        assertThat(entry.isRatingEnabled()).isFalse();
        assertThat(entry.isRatable()).isFalse();
    }

    @Test
    void 스위치를_끄면_기준_난이도와_속성이_있어도_대상이_아니다() {
        entry.changeTier(new BigDecimal("6.0"), false, 1);
        entry.changePattern(PatternType.SINGLE, false);
        entry.changeRatingEnabled(true);
        assertThat(entry.isRatable()).isTrue();

        entry.changeRatingEnabled(false);

        assertThat(entry.isRatable()).isFalse();
        assertThat(entry.isSingleGroup()).isFalse();
        assertThat(entry.isOtherGroup()).isFalse();
    }

    @Test
    void 기준_난이도도_속성도_없으면_대상이_아니다() {
        assertThat(entry.isRatable()).isFalse();
        assertThat(entry.isSingleGroup()).isFalse();
        assertThat(entry.isOtherGroup()).isFalse();
    }

    @Test
    void 기준_난이도만_있고_속성이_없으면_대상이_아니다() {
        entry.changeTier(new BigDecimal("6.0"), false, 1);

        assertThat(entry.isRatable()).isFalse();
    }

    @Test
    void 속성만_있고_기준_난이도가_없으면_대상이_아니다() {
        entry.changePattern(PatternType.SINGLE, false);

        assertThat(entry.isRatable()).isFalse();
    }

    @Test
    void 속성이_레이팅_제외면_대상이_아니다() {
        entry.changeTier(new BigDecimal("6.0"), false, 1);
        entry.changePattern(PatternType.EXCLUDED, false);

        assertThat(entry.isRatable()).isFalse();
        assertThat(entry.isSingleGroup()).isFalse();
        assertThat(entry.isOtherGroup()).isFalse();
    }

    @Test
    void 단일은_단일_그룹에_들어간다() {
        entry.changeRatingEnabled(true);
        entry.changeTier(new BigDecimal("6.0"), false, 1);
        entry.changePattern(PatternType.SINGLE, false);

        assertThat(entry.isRatable()).isTrue();
        assertThat(entry.isSingleGroup()).isTrue();
        assertThat(entry.isOtherGroup()).isFalse();
    }

    @Test
    void 복합_이중_삼중은_그_외_그룹에_들어간다() {
        entry.changeRatingEnabled(true);
        entry.changeTier(new BigDecimal("6.0"), false, 1);

        for (PatternType type : new PatternType[]{PatternType.COMPOUND, PatternType.DOUBLE, PatternType.TRIPLE}) {
            entry.changePattern(type, false);
            assertThat(entry.isOtherGroup()).as(type.name()).isTrue();
            assertThat(entry.isSingleGroup()).as(type.name()).isFalse();
        }
    }

    @Test
    void 기준_난이도는_소수_첫째_자리로_맞춘다() {
        entry.changeTier(new BigDecimal("6.50"), true, 3);

        assertThat(entry.getTierLabel()).isEqualByComparingTo("6.5");
        assertThat(entry.getTierLabel().scale()).isEqualTo(1);
        assertThat(entry.isTierUncertain()).isTrue();
    }

    @Test
    void 기준_난이도를_미정으로_돌릴_때_불확실_표시를_끄면_꺼진다() {
        entry.changeTier(new BigDecimal("6.0"), true, 1);

        entry.changeTier(null, false, null);

        assertThat(entry.getTierLabel()).isNull();
        assertThat(entry.isTierUncertain()).isFalse();
    }

    @Test
    void 값_없이_물음표만_있는_기준_난이도는_미정이면서_불확실로_저장한다() {
        entry.changeTier(null, true, null);

        assertThat(entry.getTierLabel()).isNull();
        assertThat(entry.isTierUncertain()).isTrue();
        assertThat(entry.isRatable()).isFalse();
    }

    @Test
    void 기준_난이도가_음수이거나_소수_둘째_자리면_거부한다() {
        assertThatThrownBy(() -> entry.changeTier(new BigDecimal("-0.1"), false, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> entry.changeTier(new BigDecimal("6.05"), false, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
