package com.srpfreaks.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 곡 요청의 BPM 범위(D105): 비어 있으면 통과, 정수 1~2000만 허용한다. 최소 <= 최대는 서비스가 검사한다. */
class SongRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private SongRequest withBpm(Integer min, Integer max) {
        return new SongRequest("곡", null, null, null, min, max, null, null);
    }

    @Test
    void BPM이_비어_있거나_경계값_안이면_통과한다() {
        assertThat(validator.validate(withBpm(null, null))).isEmpty();
        assertThat(validator.validate(withBpm(1, null))).isEmpty();
        assertThat(validator.validate(withBpm(1, 2000))).isEmpty();
        assertThat(validator.validate(withBpm(150, 150))).isEmpty();
    }

    @Test
    void BPM이_0_이하이거나_2000을_넘으면_거부한다() {
        assertThat(validator.validate(withBpm(0, null))).isNotEmpty();
        assertThat(validator.validate(withBpm(-5, 100))).isNotEmpty();
        assertThat(validator.validate(withBpm(100, 2001))).isNotEmpty();
        assertThat(validator.validate(withBpm(2001, null))).isNotEmpty();
    }
}
