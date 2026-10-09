package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NoticeTest {

    @Test
    void 제목과_내용의_앞뒤_공백을_잘라_저장한다() {
        Notice notice = Notice.create(null, "  안내  ", "\n 내용 \n");

        assertThat(notice.getTitle()).isEqualTo("안내");
        assertThat(notice.getContent()).isEqualTo("내용");
    }

    @Test
    void 줄바꿈은_본문_안에서_그대로_둔다() {
        assertThat(Notice.create(null, "t", "1\n2").getContent()).isEqualTo("1\n2");
    }

    @Test
    void 제목이_비었거나_100자를_넘으면_거부한다() {
        assertThatThrownBy(() -> Notice.create(null, "   ", "내용")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Notice.create(null, null, "내용")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Notice.create(null, "가".repeat(101), "내용")).isInstanceOf(IllegalArgumentException.class);
        assertThat(Notice.create(null, "가".repeat(100), "내용").getTitle()).hasSize(100);
    }

    @Test
    void 내용이_비었거나_5000자를_넘으면_거부한다() {
        assertThatThrownBy(() -> Notice.create(null, "제목", " ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Notice.create(null, "제목", "가".repeat(5001))).isInstanceOf(IllegalArgumentException.class);
        assertThat(Notice.create(null, "제목", "가".repeat(5000)).getContent()).hasSize(5000);
    }

    @Test
    void 고치면_제목과_내용이_바뀌고_쓴_사람은_그대로다() {
        User author = User.create("sub", "a@example.com", "author");
        Notice notice = Notice.create(author, "이전", "이전 내용");

        notice.edit("새 제목", "새 내용");

        assertThat(notice.getTitle()).isEqualTo("새 제목");
        assertThat(notice.getContent()).isEqualTo("새 내용");
        assertThat(notice.getAuthor()).isSameAs(author);
    }

    @Test
    void 고칠_때도_빈_값은_거부하고_기존_값을_지킨다() {
        Notice notice = Notice.create(null, "제목", "내용");

        assertThatThrownBy(() -> notice.edit("", "새 내용")).isInstanceOf(IllegalArgumentException.class);
        assertThat(notice.getTitle()).isEqualTo("제목");
        assertThat(notice.getContent()).isEqualTo("내용");
    }
}
