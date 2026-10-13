package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImportTokenTest {

    private static final Instant NOW = Instant.parse("2026-10-13T00:00:00Z");

    private ImportToken token() {
        return ImportToken.issue(User.create("sub-1", "a@example.com", null), "h".repeat(64));
    }

    @Test
    void 처음에는_폐기되지_않았고_사용_기록이_없다() {
        ImportToken t = token();

        assertThat(t.isRevoked()).isFalse();
        assertThat(t.getLastUsedAt()).isNull();
    }

    @Test
    void 폐기하면_폐기_상태가_되고_다시_폐기해도_처음_시각을_유지한다() {
        ImportToken t = token();

        t.revoke(NOW);
        t.revoke(NOW.plusSeconds(60));

        assertThat(t.isRevoked()).isTrue();
        assertThat(t.getRevokedAt()).isEqualTo(NOW);
    }

    @Test
    void 사용하면_마지막_사용_시각이_바뀐다() {
        ImportToken t = token();

        t.markUsed(NOW);

        assertThat(t.getLastUsedAt()).isEqualTo(NOW);
    }

    @Test
    void 사용자나_해시가_없으면_만들_수_없다() {
        assertThatThrownBy(() -> ImportToken.issue(null, "h".repeat(64))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ImportToken.issue(User.create("s", "a@example.com", null), null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
