package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.config.AppProperties;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.security.GoogleIdentity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 계정 찾기/만들기, ROOT 부트스트랩(ROOT_EMAIL), 차단·이메일 충돌. */
@ExtendWith(MockitoExtension.class)
class UserAccountServiceTest {

    @Mock
    UserRepository userRepository;

    AppProperties appProperties;
    UserAccountService service;

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        service = new UserAccountService(userRepository, appProperties);
    }

    private void stubNewUser() {
        when(userRepository.findByGoogleSub(any())).thenReturn(Optional.empty());
        when(userRepository.findByEmail(any())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private static void assertAuthFailed(Throwable thrown) {
        assertThat(thrown).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.AUTH_FAILED));
    }

    @Test
    void 처음_로그인하면_USER_계정을_만든다() {
        stubNewUser();

        User user = service.findOrCreate(new GoogleIdentity("sub-1", "a@example.com"));

        assertThat(user.getRole()).isEqualTo(Role.USER);
        assertThat(user.getGoogleSub()).isEqualTo("sub-1");
        assertThat(user.getEmail()).isEqualTo("a@example.com");
    }

    @Test
    void 이미_있는_계정은_그대로_돌려준다() {
        User existing = User.create("sub-1", "a@example.com", null);
        when(userRepository.findByGoogleSub("sub-1")).thenReturn(Optional.of(existing));

        assertThat(service.findOrCreate(new GoogleIdentity("sub-1", "a@example.com"))).isSameAs(existing);
        verify(userRepository, never()).save(any());
    }

    @Test
    void ROOT_EMAIL로_처음_가입하고_ROOT가_아직_없으면_ROOT가_된다() {
        appProperties.setRootEmail("Root@Example.com");   // 대소문자는 구분하지 않는다
        stubNewUser();
        when(userRepository.existsByRole(Role.ROOT)).thenReturn(false);

        User user = service.findOrCreate(new GoogleIdentity("sub-root", "root@example.com"));

        assertThat(user.getRole()).isEqualTo(Role.ROOT);
    }

    @Test
    void ROOT가_이미_있으면_ROOT_EMAIL로_가입해도_USER다() {
        appProperties.setRootEmail("root@example.com");
        stubNewUser();
        when(userRepository.existsByRole(Role.ROOT)).thenReturn(true);

        assertThat(service.findOrCreate(new GoogleIdentity("sub-x", "root@example.com")).getRole()).isEqualTo(Role.USER);
    }

    @Test
    void ROOT_EMAIL이_아닌_이메일은_USER다() {
        appProperties.setRootEmail("root@example.com");
        stubNewUser();

        assertThat(service.findOrCreate(new GoogleIdentity("sub-2", "other@example.com")).getRole()).isEqualTo(Role.USER);
        verify(userRepository, never()).existsByRole(any());
    }

    @Test
    void ROOT_EMAIL을_설정하지_않으면_아무도_ROOT가_되지_않는다() {
        stubNewUser();   // rootEmail = null

        assertThat(service.findOrCreate(new GoogleIdentity("sub-2", "root@example.com")).getRole()).isEqualTo(Role.USER);

        appProperties.setRootEmail("  ");
        assertThat(service.findOrCreate(new GoogleIdentity("sub-3", "root@example.com")).getRole()).isEqualTo(Role.USER);
    }

    @Test
    void 이미_가입한_일반_계정은_ROOT_EMAIL과_같아도_승격되지_않는다() {
        appProperties.setRootEmail("a@example.com");
        User existing = User.create("sub-1", "a@example.com", null);
        when(userRepository.findByGoogleSub("sub-1")).thenReturn(Optional.of(existing));

        assertThat(service.findOrCreate(new GoogleIdentity("sub-1", "a@example.com")).getRole()).isEqualTo(Role.USER);
        verify(userRepository, never()).existsByRole(any());
    }

    @Test
    void 차단된_계정은_로그인할_수_없다() {
        User blocked = User.create("sub-1", "a@example.com", null);
        blocked.block();
        when(userRepository.findByGoogleSub("sub-1")).thenReturn(Optional.of(blocked));

        assertThatThrownBy(() -> service.findOrCreate(new GoogleIdentity("sub-1", "a@example.com")))
                .satisfies(UserAccountServiceTest::assertAuthFailed);
    }

    @Test
    void 이메일이_같아도_sub가_다르면_기존_계정을_넘겨주지_않는다() {
        when(userRepository.findByGoogleSub("sub-new")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("a@example.com")).thenReturn(Optional.of(User.create("sub-1", "a@example.com", null)));

        assertThatThrownBy(() -> service.findOrCreate(new GoogleIdentity("sub-new", "a@example.com")))
                .satisfies(UserAccountServiceTest::assertAuthFailed);
        verify(userRepository, never()).save(any());
    }

    @Test
    void 구글_이메일이_바뀌었으면_갱신한다() {
        User existing = User.create("sub-1", "old@example.com", null);
        when(userRepository.findByGoogleSub("sub-1")).thenReturn(Optional.of(existing));
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());

        service.findOrCreate(new GoogleIdentity("sub-1", "new@example.com"));

        assertThat(existing.getEmail()).isEqualTo("new@example.com");
    }

    @Test
    void 바뀐_이메일을_다른_사용자가_쓰고_있으면_거부한다() {
        User existing = User.create("sub-1", "old@example.com", null);
        when(userRepository.findByGoogleSub("sub-1")).thenReturn(Optional.of(existing));
        when(userRepository.findByEmail("taken@example.com")).thenReturn(Optional.of(User.create("sub-2", "taken@example.com", null)));

        assertThatThrownBy(() -> service.findOrCreate(new GoogleIdentity("sub-1", "taken@example.com")))
                .satisfies(UserAccountServiceTest::assertAuthFailed);
        assertThat(existing.getEmail()).isEqualTo("old@example.com");
    }

    @Test
    void 동시_가입으로_유니크_충돌이_나면_AUTH_FAILED() {
        when(userRepository.findByGoogleSub(any())).thenReturn(Optional.empty());
        when(userRepository.findByEmail(any())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> service.findOrCreate(new GoogleIdentity("sub-1", "a@example.com")))
                .satisfies(UserAccountServiceTest::assertAuthFailed);
    }
}
