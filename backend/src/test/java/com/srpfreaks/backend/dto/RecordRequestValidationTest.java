package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.NoteOption;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** 달성률 경계값(0.00, 100.00, -0.01, 100.01, 소수 셋째 자리)과 필수값 검증. */
class RecordRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private RecordRequest withRate(BigDecimal rate) {
        return new RecordRequest(1L, NoteOption.SUPER_RANDOM_PLUS, rate, false, null, null, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.00", "0", "80.5", "99.99", "100.00", "100"})
    void 범위_안의_달성률은_통과한다(String value) {
        assertThat(validator.validate(withRate(new BigDecimal(value)))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"-0.01", "100.01", "101", "-1", "95.555", "99.999", "1000.00"})
    void 범위를_벗어나거나_소수_셋째_자리가_있으면_거부한다(String value) {
        assertThat(validator.validate(withRate(new BigDecimal(value)))).isNotEmpty();
    }

    @Test
    void 달성률은_필수고_노트_옵션은_비워도_된다() {
        RecordRequest noRate = new RecordRequest(1L, NoteOption.SUPER_RANDOM_PLUS, null, false, null, null, null);
        RecordRequest noOption = new RecordRequest(1L, null, new BigDecimal("90.00"), false, null, null, null);

        assertThat(validator.validate(noRate)).extracting(v -> v.getMessage()).contains("달성률은 필수입니다.");
        // 비우면 서비스가 SRN+로 저장한다 (D25)
        assertThat(validator.validate(noOption)).isEmpty();
    }

    @Test
    void 메모는_255자까지다() {
        RecordRequest ok = new RecordRequest(1L, NoteOption.SUPER_RANDOM_PLUS, BigDecimal.TEN, false, null, null, "가".repeat(255));
        RecordRequest tooLong = new RecordRequest(1L, NoteOption.SUPER_RANDOM_PLUS, BigDecimal.TEN, false, null, null, "가".repeat(256));

        assertThat(validator.validate(ok)).isEmpty();
        assertThat(validator.validate(tooLong)).isNotEmpty();
    }
}
