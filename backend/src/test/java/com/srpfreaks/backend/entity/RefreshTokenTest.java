package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RefreshTokenTest {

    private static final Instant NOW = Instant.parse("2026-10-05T00:00:00Z");

    private RefreshToken token(Instant expiresAt) {
        User user = User.create("sub-1", "a@example.com", null);
        return RefreshToken.issue(user, "11111111-1111-1111-1111-111111111111", "h".repeat(64), expiresAt);
    }

    @Test
    void 만료_전이고_폐기되지_않았으면_쓸_수_있다() {
        assertThat(token(NOW.plusSeconds(60)).isUsable(NOW)).isTrue();
    }

    @Test
    void 만료_시각이_되면_쓸_수_없다() {
        RefreshToken t = token(NOW);

        assertThat(t.isExpired(NOW)).isTrue();
        assertThat(t.isUsable(NOW)).isFalse();
    }

    @Test
    void 폐기하면_쓸_수_없다() {
        RefreshToken t = token(NOW.plusSeconds(60));

        t.revoke(NOW);

        assertThat(t.isRevoked()).isTrue();
        assertThat(t.isUsable(NOW)).isFalse();
    }

    @Test
    void 이미_폐기된_토큰은_처음_폐기한_시각을_유지한다() {
        RefreshToken t = token(NOW.plusSeconds(60));

        t.revoke(NOW);
        t.revoke(NOW.plusSeconds(10));

        assertThat(t.getRevokedAt()).isEqualTo(NOW);
    }

    @Test
    void 필수_값이_없으면_거부한다() {
        assertThatThrownBy(() -> RefreshToken.issue(null, "f", "h", NOW)).isInstanceOf(IllegalArgumentException.class);
    }
}
