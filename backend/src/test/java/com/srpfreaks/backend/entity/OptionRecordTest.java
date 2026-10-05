package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 달성률 경계값, FC 자동 처리, 소유자 확인 (DB 없이 도메인 규칙만 검사). */
class OptionRecordTest {

    private User user;
    private SongDifficulty difficulty;

    @BeforeEach
    void setUp() {
        user = User.create("google-sub-1", "a@example.com", "tester");
        ReflectionTestUtils.setField(user, "id", 1L);
        Song song = Song.create("Sample", "Artist", "test", null);
        difficulty = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.85"));
    }

    private OptionRecord record(String rate, boolean fullCombo) {
        return OptionRecord.create(user, difficulty, NoteOption.SUPER_RANDOM_PLUS,
                new BigDecimal(rate), fullCombo, null, null, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.00", "0", "80", "95.5", "99.99", "100.00", "100"})
    void 허용_범위의_달성률은_저장된다(String rate) {
        OptionRecord r = record(rate, false);

        assertThat(r.getAchievementRate()).isEqualByComparingTo(rate);
        assertThat(r.getAchievementRate().scale()).isEqualTo(2); // DECIMAL(5,2)와 같은 모양
    }

    @ParameterizedTest
    @ValueSource(strings = {"-0.01", "100.01", "-1", "101", "95.555", "99.999", "0.001"})
    void 범위를_벗어나거나_소수_셋째_자리가_있으면_거부한다(String rate) {
        assertThatThrownBy(() -> record(rate, false)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 끝자리가_0인_셋째_자리는_같은_값이라_허용한다() {
        assertThat(record("95.500", false).getAchievementRate()).isEqualByComparingTo("95.50");
    }

    @Test
    void 달성률이_없으면_거부한다() {
        assertThatThrownBy(() -> OptionRecord.create(user, difficulty, NoteOption.NORMAL, null, false, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 달성률_100이면_FC가_아니라고_입력해도_FC로_저장한다() {
        assertThat(record("100.00", false).isFullCombo()).isTrue();
    }

    @Test
    void 달성률_100_미만이면_입력한_FC_값을_그대로_쓴다() {
        assertThat(record("99.99", false).isFullCombo()).isFalse();
        assertThat(record("99.99", true).isFullCombo()).isTrue();
    }

    @Test
    void 플레이_시각을_안_주면_지금으로_정한다() {
        Instant before = Instant.now();
        OptionRecord r = record("90.00", false);

        assertThat(r.getPlayedAt()).isBetween(before, Instant.now());
    }

    @Test
    void 플레이_시각을_주면_그대로_쓴다() {
        Instant playedAt = Instant.parse("2026-10-01T12:00:00Z");
        OptionRecord r = OptionRecord.create(user, difficulty, NoteOption.NORMAL,
                new BigDecimal("90.00"), false, playedAt, Platform.ARCADE, "메모");

        assertThat(r.getPlayedAt()).isEqualTo(playedAt);
        assertThat(r.getPlatform()).isEqualTo(Platform.ARCADE);
    }

    @Test
    void 메모가_255자를_넘으면_거부한다() {
        String longMemo = "가".repeat(256);

        assertThatThrownBy(() -> OptionRecord.create(user, difficulty, NoteOption.NORMAL,
                new BigDecimal("90.00"), false, null, null, longMemo))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 수정해도_같은_검증을_거친다() {
        OptionRecord r = record("90.00", false);

        r.update(NoteOption.RANDOM, new BigDecimal("100.00"), false, null, null, null);
        assertThat(r.getNoteOption()).isEqualTo(NoteOption.RANDOM);
        assertThat(r.isFullCombo()).isTrue();

        assertThatThrownBy(() -> r.update(NoteOption.RANDOM, new BigDecimal("100.01"), false, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 소유자_확인() {
        OptionRecord r = record("90.00", false);

        assertThat(r.isOwnedBy(1L)).isTrue();
        assertThat(r.isOwnedBy(2L)).isFalse();
        assertThat(r.isOwnedBy(null)).isFalse();
    }
}
