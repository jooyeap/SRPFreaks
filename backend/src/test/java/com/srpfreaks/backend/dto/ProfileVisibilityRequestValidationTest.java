package com.srpfreaks.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 공개 여부 요청: true/false만 받고 값이 빠지면 거부한다(빠진 값을 false로 오해해 공개가 꺼지지 않게). */
class ProfileVisibilityRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void true와_false는_통과한다() {
        assertThat(validator.validate(new ProfileVisibilityRequest(true))).isEmpty();
        assertThat(validator.validate(new ProfileVisibilityRequest(false))).isEmpty();
    }

    @Test
    void 값이_없으면_거부한다() {
        assertThat(validator.validate(new ProfileVisibilityRequest(null))).isNotEmpty();
    }
}
