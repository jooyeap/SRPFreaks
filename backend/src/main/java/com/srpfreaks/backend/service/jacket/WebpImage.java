package com.srpfreaks.backend.service.jacket;

import java.util.Optional;

/**
 * 재킷(D54)으로 받는 WebP 파일의 머리만 읽어서 형식과 크기를 확인한다.
 *
 * 왜 직접 읽나: 이미지 라이브러리를 추가하지 않고(의존성 추가 없음), 다시 인코딩하지도 않는다.
 * 브라우저가 이미 200px WebP로 줄여 보내므로 서버는 "정말 WebP인지, 너무 크지 않은지"만 막으면 된다.
 * nginx는 이 파일을 image/webp로만 내보내므로(nosniff) 다른 형식이 섞여도 실행되지는 않지만, 저장 전에 거른다.
 *
 * WebP 구조: "RIFF" + 길이(4) + "WEBP" + 첫 청크 이름(4) + 청크 길이(4) + 내용.
 * 첫 청크가 VP8(손실)·VP8L(무손실)·VP8X(확장, 투명도 등) 중 하나이고, 가로·세로는 청크마다 적힌 자리가 다르다.
 */
public record WebpImage(int width, int height) {

    /** 형식이 맞으면 가로·세로를, 아니면 빈 값을 돌려준다. 예외를 던지지 않는다. */
    public static Optional<WebpImage> read(byte[] b) {
        if (b == null || b.length < 30) {
            return Optional.empty();
        }
        if (!ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) {
            return Optional.empty();
        }
        // RIFF 길이 = 파일 전체 - 8. 잘린 파일이나 뒤에 다른 것을 붙인 파일을 거른다
        long riffSize = le32(b, 4);
        if (riffSize + 8 != b.length) {
            return Optional.empty();
        }
        if (ascii(b, 12, "VP8X")) {
            // 24~26: 가로-1, 27~29: 세로-1 (24비트 little endian)
            int w = le24(b, 24) + 1;
            int h = le24(b, 27) + 1;
            return Optional.of(new WebpImage(w, h));
        }
        if (ascii(b, 12, "VP8 ")) {
            // 20~22: 프레임 태그, 23~25: 시작 코드 9d 01 2a, 26~27: 가로, 28~29: 세로 (아래 14비트)
            if ((b[23] & 0xff) != 0x9d || (b[24] & 0xff) != 0x01 || (b[25] & 0xff) != 0x2a) {
                return Optional.empty();
            }
            int w = le16(b, 26) & 0x3fff;
            int h = le16(b, 28) & 0x3fff;
            return w > 0 && h > 0 ? Optional.of(new WebpImage(w, h)) : Optional.empty();
        }
        if (ascii(b, 12, "VP8L")) {
            // 20: 서명 0x2f, 21~24: 가로-1(14비트) + 세로-1(14비트)
            if ((b[20] & 0xff) != 0x2f) {
                return Optional.empty();
            }
            long bits = le32(b, 21);
            int w = (int) (bits & 0x3fff) + 1;
            int h = (int) ((bits >> 14) & 0x3fff) + 1;
            return Optional.of(new WebpImage(w, h));
        }
        return Optional.empty();
    }

    private static boolean ascii(byte[] b, int at, String text) {
        for (int i = 0; i < text.length(); i++) {
            if (b[at + i] != (byte) text.charAt(i)) {
                return false;
            }
        }
        return true;
    }

    private static int le16(byte[] b, int at) {
        return (b[at] & 0xff) | (b[at + 1] & 0xff) << 8;
    }

    private static int le24(byte[] b, int at) {
        return le16(b, at) | (b[at + 2] & 0xff) << 16;
    }

    private static long le32(byte[] b, int at) {
        return (le24(b, at) | (long) (b[at + 3] & 0xff) << 24) & 0xffffffffL;
    }
}
