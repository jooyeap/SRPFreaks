package com.srpfreaks.backend.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ImportRecentPlaysRequestTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private static ImportPlayRequest play(int rate) {
        return new ImportPlayRequest(1_760_000_000_000L, "gf", "Alpha", "gf_mst", rate, 0, 0, false,
                List.of("gf_random_5", "gf_button_1", "gf_auto_1"));
    }

    @Test
    void 정상_요청은_통과한다() {
        assertThat(validator.validate(new ImportRecentPlaysRequest(List.of(play(0), play(10_000))))).isEmpty();
    }

    @Test
    void 달성률_경계를_검증한다() {
        assertThat(validator.validate(new ImportRecentPlaysRequest(List.of(play(-1))))).isNotEmpty();
        assertThat(validator.validate(new ImportRecentPlaysRequest(List.of(play(10_001))))).isNotEmpty();
    }

    @Test
    void 곡이_없거나_20곡을_넘으면_거절한다() {
        assertThat(validator.validate(new ImportRecentPlaysRequest(List.of()))).isNotEmpty();
        assertThat(validator.validate(new ImportRecentPlaysRequest(Collections.nCopies(21, play(5000))))).isNotEmpty();
        assertThat(validator.validate(new ImportRecentPlaysRequest(Collections.nCopies(20, play(5000))))).isEmpty();
    }

    @Test
    void 옵션이_너무_많거나_빈_값이면_거절한다() {
        ImportPlayRequest many = new ImportPlayRequest(1_760_000_000_000L, "gf", "Alpha", "gf_mst", 5000, 0, 0, false,
                Collections.nCopies(11, "gf_random_5"));
        ImportPlayRequest blank = new ImportPlayRequest(1_760_000_000_000L, "gf", "Alpha", "gf_mst", 5000, 0, 0, false,
                List.of(" "));

        assertThat(validator.validate(new ImportRecentPlaysRequest(List.of(many)))).isNotEmpty();
        assertThat(validator.validate(new ImportRecentPlaysRequest(List.of(blank)))).isNotEmpty();
    }
}
