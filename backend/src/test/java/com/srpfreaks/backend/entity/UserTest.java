package com.srpfreaks.backend.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserTest {

    @Test
    void 새_사용자는_USER_권한과_ACTIVE_상태다() {
        User user = User.create("sub-1", "a@example.com", "たろう");

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
        User user = User.create("sub-1", "a@example.com", "  たろう  ");
        assertThat(user.getNickname()).isEqualTo("たろう");

        user.changeNickname("   ");
        assertThat(user.getNickname()).isNull();
    }

    @Test
    void 닉네임은_2자_이상_12자_이하만_허용한다() {
        User user = User.create("sub-1", "a@example.com", null);

        user.changeNickname("ab");
        user.changeNickname("a".repeat(12));
        assertThatThrownBy(() -> user.changeNickname("a")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> user.changeNickname("a".repeat(13))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 일본어는_히라가나_가타카나_한자_모두_한_글자로_센다() {
        User user = User.create("sub-1", "a@example.com", null);

        user.changeNickname("あいうえおかきくけこさし"); // 히라가나 12자
        user.changeNickname("アイウエオカキクケコサシ"); // 가타카나 12자
        user.changeNickname("日本語日本語日本語日本語"); // 한자 12자
        assertThat(user.getNickname()).hasSize(12);
        assertThatThrownBy(() -> user.changeNickname("日本語日本語日本語日本語日")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void UTF16_두_칸짜리_드문_한자도_한_글자로_센다() {
        User user = User.create("sub-1", "a@example.com", null);

        user.changeNickname("𠮷".repeat(12)); // 코드 포인트 12개 = UTF-16 24칸
        assertThat(user.getNickname().codePointCount(0, user.getNickname().length())).isEqualTo(12);
        assertThatThrownBy(() -> user.changeNickname("𠮷".repeat(13))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 영문_숫자_일본어와_허용_기호만_쓸_수_있다() {
        User user = User.create("sub-1", "a@example.com", null);

        user.changeNickname("Taro_01");
        user.changeNickname("たろう-ー・1");
        user.changeNickname("佐々木"); // 々는 일본어 이름에 흔하다
        assertThatThrownBy(() -> user.changeNickname("닉네임")).isInstanceOf(IllegalArgumentException.class); // 한글
        assertThatThrownBy(() -> user.changeNickname("ta ro")).isInstanceOf(IllegalArgumentException.class); // 공백
        assertThatThrownBy(() -> user.changeNickname("taro😀")).isInstanceOf(IllegalArgumentException.class); // 이모지
        assertThatThrownBy(() -> user.changeNickname("taro!")).isInstanceOf(IllegalArgumentException.class); // 허용하지 않는 기호
        assertThatThrownBy(() -> user.changeNickname("café")).isInstanceOf(IllegalArgumentException.class); // 영문 외 라틴 문자
    }

    @Test
    void NFKC로_정규화해서_저장한다() {
        User user = User.create("sub-1", "a@example.com", null);

        user.changeNickname("ﾀﾛｳ"); // 반각 가타카나 -> 전각
        assertThat(user.getNickname()).isEqualTo("タロウ");

        user.changeNickname("Ｔａｒｏ１"); // 전각 영문·숫자 -> 반각
        assertThat(user.getNickname()).isEqualTo("Taro1");
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
