package com.srpfreaks.backend.service.jacket;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/** 재킷(D54) WebP 머리 읽기: 세 가지 형식의 가로·세로, 다른 형식·잘린 파일 거절. */
class WebpImageTest {

    @Test
    void 손실_압축의_가로세로를_읽는다() {
        assertThat(WebpImage.read(WebpFixtures.vp8(200, 200, 100))).contains(new WebpImage(200, 200));
    }

    @Test
    void 무손실의_가로세로를_읽는다() {
        assertThat(WebpImage.read(WebpFixtures.vp8l(200, 180))).contains(new WebpImage(200, 180));
    }

    @Test
    void 확장형의_가로세로를_읽는다() {
        assertThat(WebpImage.read(WebpFixtures.vp8x(384, 384))).contains(new WebpImage(384, 384));
    }

    @Test
    void JPEG나_PNG는_거절한다() {
        byte[] jpeg = new byte[64];
        jpeg[0] = (byte) 0xff; jpeg[1] = (byte) 0xd8; jpeg[2] = (byte) 0xff;
        byte[] png = Arrays.copyOf("\u0089PNG\r\n\u001a\n".getBytes(StandardCharsets.ISO_8859_1), 64);

        assertThat(WebpImage.read(jpeg)).isEmpty();
        assertThat(WebpImage.read(png)).isEmpty();
        assertThat(WebpImage.read(null)).isEmpty();
        assertThat(WebpImage.read(new byte[10])).isEmpty();
    }

    @Test
    void 길이가_머리와_다르면_거절한다() {
        byte[] ok = WebpFixtures.vp8(200, 200, 10);

        assertThat(WebpImage.read(Arrays.copyOf(ok, ok.length - 1))).isEmpty();   // 잘린 파일
        assertThat(WebpImage.read(Arrays.copyOf(ok, ok.length + 16))).isEmpty();  // 뒤에 다른 내용을 붙인 파일
    }

    @Test
    void 시작_코드가_틀린_손실_압축은_거절한다() {
        byte[] bad = WebpFixtures.vp8(200, 200, 0);
        bad[23] = 0;

        assertThat(WebpImage.read(bad)).isEmpty();
    }
}
