package com.srpfreaks.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** 서열표 값 수정 요청: 기준 난이도 범위·자릿수와 추천도·속성 허용 값. 모두 비워도 된다(미정/값 없음). */
class TableEntryUpdateRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void 모두_비워도_통과한다() {
        assertThat(validator.validate(new TableEntryUpdateRequest(null, null, null))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "0.0", "5.8", "6", "9.9", "10.5", "99.9"})
    void 허용_범위의_기준_난이도는_통과한다(String value) {
        assertThat(validator.validate(new TableEntryUpdateRequest(new BigDecimal(value), null, null))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"-0.1", "100.0", "5.85", "5.855", "100"})
    void 범위를_벗어나거나_소수_둘째_자리가_있으면_거부한다(String value) {
        assertThat(validator.validate(new TableEntryUpdateRequest(new BigDecimal(value), null, null))).isNotEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"상", "중", "하"})
    void 추천도는_상_중_하만_받는다(String value) {
        assertThat(validator.validate(new TableEntryUpdateRequest(null, value, null))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"최상", "HIGH", "", " 상"})
    void 다른_추천도는_거부한다(String value) {
        assertThat(validator.validate(new TableEntryUpdateRequest(null, value, null))).isNotEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"단일", "복합", "이중", "삼중", "레이팅 제외"})
    void 속성은_정해진_다섯_값만_받는다(String value) {
        assertThat(validator.validate(new TableEntryUpdateRequest(null, null, value))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"단일 ", "SINGLE", "레이팅제외", ""})
    void 다른_속성은_거부한다(String value) {
        assertThat(validator.validate(new TableEntryUpdateRequest(null, null, value))).isNotEmpty();
    }
}
