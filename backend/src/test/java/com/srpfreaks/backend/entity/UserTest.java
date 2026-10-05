package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserTest {

    @Test
    void 새_사용자는_USER_권한과_ACTIVE_상태다() {
        User user = User.create("sub-1", "a@example.com", "닉네임");

        assertThat(user.getRole()).isEqualTo(Role.USER);
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.isActive()).isTrue();
    }

    @Test
    void googleSub나_email이_비면_거부한다() {
        assertThatThrownBy(() -> User.create(" ", "a@example.com", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> User.create("sub-1", "", null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 닉네임은_앞뒤_공백을_지우고_빈_값은_null로_둔다() {
        User user = User.create("sub-1", "a@example.com", "  닉네임  ");
        assertThat(user.getNickname()).isEqualTo("닉네임");

        user.changeNickname("   ");
        assertThat(user.getNickname()).isNull();
    }

    @Test
    void 닉네임이_30자를_넘으면_거부한다() {
        User user = User.create("sub-1", "a@example.com", null);

        user.changeNickname("a".repeat(30));
        assertThatThrownBy(() -> user.changeNickname("a".repeat(31))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 역할_변경과_차단() {
        User user = User.create("sub-1", "a@example.com", null);

        user.changeRole(Role.ADMIN);
        user.block();
        assertThat(user.getRole()).isEqualTo(Role.ADMIN);
        assertThat(user.isActive()).isFalse();

        user.activate();
        assertThat(user.isActive()).isTrue();
    }

    @Test
    void ROOT_초기_계정을_만들_수_있다() {
        User root = User.create("sub-root", "root@example.com", null, Role.ROOT);

        assertThat(root.getRole()).isEqualTo(Role.ROOT);
    }
}
