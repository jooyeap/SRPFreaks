package com.srpfreaks.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NoticeRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void 제목과_내용이_있으면_통과한다() {
        assertThat(validator.validate(new NoticeRequest("제목", "내용"))).isEmpty();
        assertThat(validator.validate(new NoticeRequest("가".repeat(100), "가".repeat(5000)))).isEmpty();
    }

    @Test
    void 제목이_비었거나_너무_길면_거부한다() {
        assertThat(validator.validate(new NoticeRequest(null, "내용"))).isNotEmpty();
        assertThat(validator.validate(new NoticeRequest("  ", "내용"))).isNotEmpty();
        assertThat(validator.validate(new NoticeRequest("가".repeat(101), "내용"))).isNotEmpty();
    }

    @Test
    void 내용이_비었거나_너무_길면_거부한다() {
        assertThat(validator.validate(new NoticeRequest("제목", null))).isNotEmpty();
        assertThat(validator.validate(new NoticeRequest("제목", ""))).isNotEmpty();
        assertThat(validator.validate(new NoticeRequest("제목", "가".repeat(5001)))).isNotEmpty();
    }
}
