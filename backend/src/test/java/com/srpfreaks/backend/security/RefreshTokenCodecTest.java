package com.srpfreaks.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshTokenCodecTest {

    @Test
    void 토큰은_매번_다르고_Base64url_43자다() {
        String a = RefreshTokenCodec.generate();
        String b = RefreshTokenCodec.generate();

        assertThat(a).isNotEqualTo(b);
        assertThat(a).hasSize(43).matches("[A-Za-z0-9_-]+");
    }

    @Test
    void 해시는_SHA256_16진수_64자이고_같은_입력은_같은_값이다() {
        // SHA-256("abc")의 알려진 값
        assertThat(RefreshTokenCodec.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assertThat(RefreshTokenCodec.hash("x")).hasSize(64).isEqualTo(RefreshTokenCodec.hash("x"));
    }

    @Test
    void 해시에서_원문을_알_수_없다() {
        String raw = RefreshTokenCodec.generate();

        assertThat(RefreshTokenCodec.hash(raw)).doesNotContain(raw);
    }
}
