package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SuggestionTest {

    private static final User USER = User.create("sub", "a@example.com", "tester");

    @Test
    void 곡_추가_건의는_요청_채보의_파트와_난이도를_함께_저장한다() {
        Suggestion s = Suggestion.create(USER, SuggestionCategory.SONG_REQUEST, "곡", "내용",
                InstrumentPart.BASS, DifficultyType.MASTER);

        assertThat(s.getRequestedPart()).isEqualTo(InstrumentPart.BASS);
        assertThat(s.getRequestedDifficulty()).isEqualTo(DifficultyType.MASTER);
    }

    @Test
    void 일반_건의는_파트와_난이도가_비어_있다() {
        Suggestion s = Suggestion.create(USER, SuggestionCategory.BUG, "제목", "내용");

        assertThat(s.getRequestedPart()).isNull();
        assertThat(s.getRequestedDifficulty()).isNull();
    }

    @Test
    void 파트와_난이도는_한_쌍이고_곡_추가_건의에서만_받는다() {
        assertThatThrownBy(() -> Suggestion.create(USER, SuggestionCategory.SONG_REQUEST, "곡", "내용",
                InstrumentPart.GUITAR, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Suggestion.create(USER, SuggestionCategory.SONG_REQUEST, "곡", "내용",
                null, DifficultyType.MASTER)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Suggestion.create(USER, SuggestionCategory.BUG, "제목", "내용",
                InstrumentPart.GUITAR, DifficultyType.MASTER)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 새_건의는_접수_상태로_시작하고_앞뒤_공백을_잘라_저장한다() {
        Suggestion s = Suggestion.create(USER, SuggestionCategory.BUG, "  제목  ", "\n 내용\n둘째 줄 \n");

        assertThat(s.getStatus()).isEqualTo(SuggestionStatus.RECEIVED);
        assertThat(s.getTitle()).isEqualTo("제목");
        assertThat(s.getContent()).isEqualTo("내용\n둘째 줄");
        assertThat(s.getAdminNote()).isNull();
    }

    @Test
    void 종류_제목_내용이_없거나_길이를_넘으면_거부한다() {
        assertThatThrownBy(() -> Suggestion.create(USER, null, "제목", "내용")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Suggestion.create(USER, SuggestionCategory.OTHER, " ", "내용")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Suggestion.create(USER, SuggestionCategory.OTHER, "가".repeat(101), "내용")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Suggestion.create(USER, SuggestionCategory.OTHER, "제목", "")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Suggestion.create(USER, SuggestionCategory.OTHER, "제목", "가".repeat(2001))).isInstanceOf(IllegalArgumentException.class);
        assertThat(Suggestion.create(USER, SuggestionCategory.OTHER, "가".repeat(100), "가".repeat(2000)).getContent()).hasSize(2000);
    }

    @Test
    void 처리하면_상태와_답변이_바뀌고_빈_답변은_NULL이다() {
        Suggestion s = Suggestion.create(USER, SuggestionCategory.SONG_REQUEST, "곡 추가", "내용");

        s.review(SuggestionStatus.DONE, "  등록했습니다.  ");
        assertThat(s.getStatus()).isEqualTo(SuggestionStatus.DONE);
        assertThat(s.getAdminNote()).isEqualTo("등록했습니다.");

        s.review(SuggestionStatus.REVIEWING, "   ");
        assertThat(s.getAdminNote()).isNull();
    }

    @Test
    void 처리할_때_상태가_없거나_답변이_500자를_넘으면_거부하고_기존_값을_지킨다() {
        Suggestion s = Suggestion.create(USER, SuggestionCategory.OTHER, "제목", "내용");

        assertThatThrownBy(() -> s.review(null, "답변")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> s.review(SuggestionStatus.DONE, "가".repeat(501))).isInstanceOf(IllegalArgumentException.class);
        assertThat(s.getStatus()).isEqualTo(SuggestionStatus.RECEIVED);
    }
}
