package com.srpfreaks.backend.service.jacket;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** 테스트용 최소 WebP 머리(내용은 비어 있다). WebpImage는 머리만 읽으므로 이것으로 형식·크기 검사를 확인한다. */
public final class WebpFixtures {

    private WebpFixtures() {
    }

    /** 손실 압축(VP8). 브라우저 Canvas가 만드는 기본 형식. */
    public static byte[] vp8(int width, int height, int extraBytes) {
        ByteArrayOutputStream chunk = new ByteArrayOutputStream();
        chunk.write(0); chunk.write(0); chunk.write(0);        // 프레임 태그
        chunk.write(0x9d); chunk.write(0x01); chunk.write(0x2a); // 시작 코드
        le16(chunk, width); le16(chunk, height);
        chunk.writeBytes(new byte[extraBytes]);
        return riff("VP8 ", chunk.toByteArray());
    }

    /** 무손실(VP8L). */
    public static byte[] vp8l(int width, int height) {
        ByteArrayOutputStream chunk = new ByteArrayOutputStream();
        chunk.write(0x2f);
        long bits = (width - 1L) | ((height - 1L) << 14);
        le32(chunk, bits);
        chunk.writeBytes(new byte[5]);
        return riff("VP8L", chunk.toByteArray());
    }

    /** 확장(VP8X). 투명도가 있으면 브라우저가 이 형식을 만든다. */
    public static byte[] vp8x(int width, int height) {
        ByteArrayOutputStream chunk = new ByteArrayOutputStream();
        le32(chunk, 0); // 플래그
        le24(chunk, width - 1); le24(chunk, height - 1);
        return riff("VP8X", chunk.toByteArray());
    }

    private static byte[] riff(String fourcc, byte[] chunk) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        body.writeBytes("WEBP".getBytes(StandardCharsets.US_ASCII));
        body.writeBytes(fourcc.getBytes(StandardCharsets.US_ASCII));
        le32(body, chunk.length);
        body.writeBytes(chunk);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes("RIFF".getBytes(StandardCharsets.US_ASCII));
        le32(out, body.size());
        out.writeBytes(body.toByteArray());
        return out.toByteArray();
    }

    private static void le16(ByteArrayOutputStream out, int v) {
        out.write(v & 0xff); out.write((v >> 8) & 0xff);
    }

    private static void le24(ByteArrayOutputStream out, int v) {
        le16(out, v); out.write((v >> 16) & 0xff);
    }

    private static void le32(ByteArrayOutputStream out, long v) {
        le24(out, (int) (v & 0xffffff)); out.write((int) ((v >> 24) & 0xff));
    }
}
