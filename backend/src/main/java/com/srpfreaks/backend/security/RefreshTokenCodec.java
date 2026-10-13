package com.srpfreaks.backend.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Refresh Token 생성과 해시.
 * 토큰은 암호학적으로 안전한 난수 32바이트(256비트)를 Base64url로 바꾼 문자열이다. 추측이 불가능하므로 서명이 필요 없다.
 * DB에는 SHA-256 해시(16진수 64자)만 저장해서, DB가 유출돼도 토큰을 되살릴 수 없다.
 */
public final class RefreshTokenCodec {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;
    /** 정상 토큰은 43자다. 이보다 훨씬 긴 값은 해시하지 않고 거부한다. */
    public static final int MAX_RAW_LENGTH = 128;

    private RefreshTokenCodec() {
    }

    public static String generate() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", e);
        }
    }
}
