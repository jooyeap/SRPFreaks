package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.SuggestionCategory;
import com.srpfreaks.backend.entity.SuggestionStatus;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SuggestionRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void 정상_요청은_통과한다() {
        assertThat(validator.validate(new SuggestionRequest(SuggestionCategory.BUG, "제목", "내용"))).isEmpty();
    }

    @Test
    void 종류_제목_내용이_비면_메시지와_함께_거부한다() {
        var violations = validator.validate(new SuggestionRequest(null, " ", ""));
        assertThat(violations).extracting("message")
                .contains("종류를 선택해 주세요.", "제목을 입력해 주세요.", "내용을 입력해 주세요.");
    }

    @Test
    void 길이_경계는_제목_100_내용_2000이다() {
        assertThat(validator.validate(new SuggestionRequest(SuggestionCategory.OTHER, "가".repeat(100), "가".repeat(2000)))).isEmpty();
        assertThat(validator.validate(new SuggestionRequest(SuggestionCategory.OTHER, "가".repeat(101), "가".repeat(2001)))).hasSize(2);
    }

    @Test
    void 처리_요청은_상태가_필수이고_답변은_500자까지다() {
        assertThat(validator.validate(new SuggestionReviewRequest(SuggestionStatus.DONE, null))).isEmpty();
        assertThat(validator.validate(new SuggestionReviewRequest(null, "답"))).hasSize(1);
        assertThat(validator.validate(new SuggestionReviewRequest(SuggestionStatus.DONE, "가".repeat(501)))).hasSize(1);
    }
}
