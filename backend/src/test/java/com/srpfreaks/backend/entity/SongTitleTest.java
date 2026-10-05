package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 곡명 비교용 정규화: NFKC, 공백/줄바꿈 제거, 소문자. */
class SongTitleTest {

    @Test
    void 공백과_줄바꿈을_없애고_소문자로_바꾼다() {
        assertThat(SongTitle.normalize("  Hello \n World\t")).isEqualTo("helloworld");
    }

    @Test
    void 전각_영문과_반각_가타카나를_같은_형태로_맞춘다() {
        assertThat(SongTitle.normalize("ＡＢＣ")).isEqualTo("abc");
        assertThat(SongTitle.normalize("ｱｲｳ")).isEqualTo("アイウ");
    }

    @Test
    void 같은_곡명의_표기_차이는_같은_값이_된다() {
        assertThat(SongTitle.normalize("DRAGON KILLER")).isEqualTo(SongTitle.normalize("ＤＲＡＧＯＮ\nＫＩＬＬＥＲ"));
    }

    @Test
    void null은_빈_문자열로_본다() {
        assertThat(SongTitle.normalize(null)).isEmpty();
    }

    @Test
    void 생성하면_정규화_값이_함께_저장된다() {
        Song song = Song.create("Sample", "Artist", "test", null);

        SongTitle title = SongTitle.create(song, TitleKind.ALIAS, "Ｓａｍｐｌｅ Song");

        assertThat(title.getTitle()).isEqualTo("Ｓａｍｐｌｅ Song");
        assertThat(title.getNormalizedTitle()).isEqualTo("samplesong");
    }
}
