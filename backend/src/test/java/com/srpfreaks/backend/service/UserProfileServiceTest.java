package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.UserResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 닉네임 변경(본인만, 규칙에 맞을 때만, 빈 값은 닉네임 없음)과 탈퇴(본인 행 삭제). */
@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    AuditLogRepository auditLogRepository;

    @InjectMocks
    UserProfileService service;

    private User existingUser(String nickname) {
        User user = User.create("sub-1", "a@example.com", nickname);
        ReflectionTestUtils.setField(user, "id", 1L); // 감사 로그의 target_id 확인용
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
    void 닉네임이_바뀌면_이전_값과_새_값을_감사_로그에_남긴다() {
        User user = existingUser("たろう");

        service.updateNickname(1L, "ｼﾞﾛｳ"); // 반각 → 정규화된 값(ジロウ)으로 비교한다

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        AuditLog log = captor.getValue();
        assertThat(log.getAction()).isEqualTo("NICKNAME_CHANGE");
        assertThat(log.getActor()).isSameAs(user); // 본인이 한 작업
        assertThat(log.getTargetType()).isEqualTo("USER");
        assertThat(log.getTargetId()).isEqualTo("1");
        assertThat(log.getDetail()).containsEntry("before", "たろう").containsEntry("after", "ジロウ");
        assertThat(log.getDetail()).doesNotContainKey("email");
    }

    @Test
    void 처음_정하거나_지울_때도_남기고_빈_쪽은_null이다() {
        existingUser(null);
        service.updateNickname(1L, "たろう");
        ArgumentCaptor<AuditLog> first = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(first.capture());
        assertThat(first.getValue().getDetail()).containsEntry("before", null).containsEntry("after", "たろう");
    }

    @Test
    void 같은_값으로_저장하면_로그를_남기지_않는다() {
        existingUser("たろう");

        service.updateNickname(1L, "たろう");
        service.updateNickname(1L, "  たろう  "); // 앞뒤 공백 정리 후 같은 값

        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }

    @Test
    void 규칙에_어긋나_거부되면_로그도_남기지_않는다() {
        existingUser("たろう");

        assertThatThrownBy(() -> service.updateNickname(1L, "닉네임")).isInstanceOf(IllegalArgumentException.class);

        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }

    @Test
    void 사용자가_없으면_UNAUTHORIZED다() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateNickname(1L, "たろう"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    void 닉네임이_있으면_공개로_바꾸고_응답에_담는다() {
        User user = existingUser("たろう");

        UserResponse response = service.updateProfilePublic(1L, true);

        assertThat(response.profilePublic()).isTrue();
        assertThat(user.isProfilePublic()).isTrue();
    }

    @Test
    void 닉네임이_없으면_공개로_바꿀_수_없다() {
        User user = existingUser(null);

        assertThatThrownBy(() -> service.updateProfilePublic(1L, true)).isInstanceOf(IllegalArgumentException.class);

        assertThat(user.isProfilePublic()).isFalse();
    }

    @Test
    void 공개를_끌_수_있다() {
        User user = existingUser("たろう");
        user.changeProfilePublic(true);

        UserResponse response = service.updateProfilePublic(1L, false);

        assertThat(response.profilePublic()).isFalse();
        assertThat(user.isProfilePublic()).isFalse();
    }

    @Test
    void 공개_설정도_없는_사용자는_UNAUTHORIZED다() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateProfilePublic(1L, true))
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
    void 탈퇴하면_본인의_닉네임_변경_로그도_지운다() {
        existingUser("たろう");

        service.withdraw(1L);

        // 닉네임 글자가 로그에 남으면 "완전 삭제"(D20)가 아니다. 다른 감사 로그는 사용자 id만 있어 FK(SET NULL)에 맡긴다
        verify(auditLogRepository).deleteByActionAndTargetTypeAndTargetId("NICKNAME_CHANGE", "USER", "1");
    }

    @Test
    void 없는_사용자의_탈퇴는_인증_오류이고_아무것도_지우지_않는다() {
        when(userRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.withdraw(9L))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED));
        verify(userRepository, never()).delete(org.mockito.ArgumentMatchers.any(User.class));
        verify(auditLogRepository, never()).deleteByActionAndTargetTypeAndTargetId(any(), any(), any());
    }
}
