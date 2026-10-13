package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.AdminUserResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserAdminServiceTest {

    @Mock UserRepository userRepository;
    @Mock AuditLogRepository auditLogRepository;

    UserAdminService service;
    User root;
    User member;

    private User user(long id, String nickname, Role role) {
        User user = User.create("sub-" + id, "u" + id + "@example.com", nickname, role);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    @BeforeEach
    void setUp() {
        service = new UserAdminService(userRepository, auditLogRepository);
        root = user(1, "ルート", Role.ROOT);
        member = user(2, "メンバー", Role.USER);
        lenient().when(userRepository.findById(1L)).thenReturn(Optional.of(root));
        lenient().when(userRepository.findById(2L)).thenReturn(Optional.of(member));
        lenient().when(userRepository.getReferenceById(1L)).thenReturn(root);
    }

    private void assertRejected(Long userId, Role role, ErrorCode expected) {
        assertThatThrownBy(() -> service.changeRole(1L, userId, role))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(expected));
        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }

    @Test
    void 목록은_이메일을_포함하고_google_sub는_내보내지_않는다() {
        when(userRepository.findAllByOrderByIdAsc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(root, member), PageRequest.of(0, 30), 2));

        var page = service.list(0, 30);

        assertThat(page.content()).extracting(AdminUserResponse::email).containsExactly("u1@example.com", "u2@example.com");
        assertThat(page.content().get(1).role()).isEqualTo(Role.USER);
        assertThat(AdminUserResponse.class.getRecordComponents())
                .extracting(c -> c.getName()).doesNotContain("googleSub");
    }

    @Test
    void USER를_ADMIN으로_올리면_저장하고_감사_로그를_남긴다() {
        AdminUserResponse response = service.changeRole(1L, 2L, Role.ADMIN);

        assertThat(response.role()).isEqualTo(Role.ADMIN);
        assertThat(member.getRole()).isEqualTo(Role.ADMIN);
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        AuditLog log = captor.getValue();
        assertThat(log.getAction()).isEqualTo("USER_ROLE_CHANGE");
        assertThat(log.getTargetId()).isEqualTo("2");
        assertThat(log.getDetail()).containsEntry("before", "USER").containsEntry("after", "ADMIN");
        assertThat(log.getDetail().toString()).doesNotContain("@"); // 이메일 같은 개인정보는 기록하지 않는다
    }

    @Test
    void ADMIN을_USER로_내릴_수_있다() {
        member.changeRole(Role.ADMIN);

        assertThat(service.changeRole(1L, 2L, Role.USER).role()).isEqualTo(Role.USER);
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void ROOT로_바꾸는_요청은_거절한다() {
        assertRejected(2L, Role.ROOT, ErrorCode.BAD_REQUEST);
        assertThat(member.getRole()).isEqualTo(Role.USER);
    }

    @Test
    void ROOT_계정의_역할은_바꿀_수_없다() {
        assertRejected(1L, Role.USER, ErrorCode.FORBIDDEN);
        assertRejected(1L, Role.ADMIN, ErrorCode.FORBIDDEN);
        assertThat(root.getRole()).isEqualTo(Role.ROOT);
    }

    @Test
    void 없는_사용자는_404이다() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertRejected(99L, Role.ADMIN, ErrorCode.NOT_FOUND);
    }

    @Test
    void 이미_그_역할이면_아무것도_하지_않는다() {
        AdminUserResponse response = service.changeRole(1L, 2L, Role.USER);

        assertThat(response.role()).isEqualTo(Role.USER);
        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }
}
