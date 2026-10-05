package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.UserResponse;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 닉네임 변경(본인만, 규칙에 맞을 때만, 빈 값은 닉네임 없음)과 탈퇴(본인 행 삭제). */
@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock
    UserRepository userRepository;

    @InjectMocks
    UserProfileService service;

    private User existingUser(String nickname) {
        User user = User.create("sub-1", "a@example.com", nickname);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    void 닉네임을_바꾸면_정규화된_값이_응답에_담긴다() {
        User user = existingUser(null);

        UserResponse response = service.updateNickname(1L, "ﾀﾛｳ"); // 반각 가타카나

        assertThat(response.nickname()).isEqualTo("タロウ");
        assertThat(user.getNickname()).isEqualTo("タロウ");
    }

    @Test
    void 빈_값이면_닉네임_없음으로_되돌린다() {
        User user = existingUser("たろう");

        UserResponse response = service.updateNickname(1L, "   ");

        assertThat(response.nickname()).isNull();
        assertThat(user.getNickname()).isNull();
    }

    @Test
    void 규칙에_어긋나면_거부하고_기존_닉네임을_유지한다() {
        User user = existingUser("たろう");

        assertThatThrownBy(() -> service.updateNickname(1L, "닉네임")).isInstanceOf(IllegalArgumentException.class); // 한글
        assertThatThrownBy(() -> service.updateNickname(1L, "a")).isInstanceOf(IllegalArgumentException.class); // 1자
        assertThatThrownBy(() -> service.updateNickname(1L, "a".repeat(13))).isInstanceOf(IllegalArgumentException.class);

        assertThat(user.getNickname()).isEqualTo("たろう");
    }

    @Test
    void 사용자가_없으면_UNAUTHORIZED다() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateNickname(1L, "たろう"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    void 탈퇴하면_본인_사용자_행을_삭제한다() {
        User user = existingUser(null);

        service.withdraw(1L);

        verify(userRepository).delete(user);
    }

    @Test
    void 없는_사용자의_탈퇴는_인증_오류이고_아무것도_지우지_않는다() {
        when(userRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.withdraw(9L))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED));
        verify(userRepository, never()).delete(org.mockito.ArgumentMatchers.any(User.class));
    }
}
