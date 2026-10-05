package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SongDifficultyTest {

    private final Song song = Song.create("Sample", "Artist", "test", null);

    private SongDifficulty create(String level) {
        return SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.EXTREME, new BigDecimal(level));
    }

    @Test
    void 레벨은_0_00부터_9_99까지_허용한다() {
        assertThat(create("0.00").getLevel()).isEqualByComparingTo("0");
        assertThat(create("9.99").getLevel()).isEqualByComparingTo("9.99");
    }

    @Test
    void 범위를_벗어나거나_소수_셋째_자리면_거부한다() {
        assertThatThrownBy(() -> create("-0.01")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> create("10.00")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> create("9.855")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 노트_수는_비워도_되고_음수는_거부한다() {
        SongDifficulty d = create("9.50");

        assertThat(d.getNoteCount()).isNull();
        d.changeNoteCount(1234);
        assertThat(d.getNoteCount()).isEqualTo(1234);
        assertThatThrownBy(() -> d.changeNoteCount(-1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 삭제는_소프트_삭제다() {
        SongDifficulty d = create("9.50");

        d.delete();
        assertThat(d.isDeleted()).isTrue();
        d.restore();
        assertThat(d.isDeleted()).isFalse();
    }
}
