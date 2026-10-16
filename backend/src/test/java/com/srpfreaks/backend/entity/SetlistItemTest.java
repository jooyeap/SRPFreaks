package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SetlistItemTest {

    private static final Instant ADDED = Instant.parse("2026-10-16T05:00:00Z");

    private SetlistItem item() {
        User user = User.create("sub", "a@example.com", "tester");
        Song song = Song.create("곡", "아티스트", "test", user);
        SongDifficulty chart = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        SetlistItem item = SetlistItem.create(user, chart);
        ReflectionTestUtils.setField(item, "createdAt", ADDED); // @PrePersist는 저장할 때만 채우므로 직접 넣는다
        return item;
    }

    @Test
    void 기록이_없으면_완료가_아니다() {
        assertThat(item().isDoneBy(null)).isFalse();
    }

    @Test
    void 담기_전에_저장한_기록은_완료로_보지_않는다() {
        assertThat(item().isDoneBy(ADDED.minusSeconds(1))).isFalse();
    }

    @Test
    void 담은_순간과_그_이후의_저장은_완료다() {
        assertThat(item().isDoneBy(ADDED)).isTrue();
        assertThat(item().isDoneBy(ADDED.plusSeconds(1))).isTrue();
    }
}
