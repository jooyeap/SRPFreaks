package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.dto.NoticeRequest;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.NoticeService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 공지사항 쓰기·수정·삭제 API의 권한 (D30): USER는 403(AccessDenied), ADMIN·ROOT는 통과(RoleHierarchy), 비로그인은 호출 불가.
 * SongControllerAuthorizationTest와 같은 방식(메서드 보안 + 실제 RoleHierarchy만 띄운다).
 */
class NoticeAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean NoticeService noticeService() { return Mockito.mock(NoticeService.class); }

        @Bean NoticeAdminController noticeAdminController(NoticeService service) {
            return new NoticeAdminController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private NoticeAdminController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(NoticeAdminController.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    private AuthenticatedUser loginAs(Role role) {
        AuthenticatedUser user = new AuthenticatedUser(1L, role);
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
        return user;
    }

    @Test
    void USER는_공지를_지울_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);

        assertThatThrownBy(() -> controller.delete(user, 3L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void USER는_공지를_쓰거나_고칠_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);
        NoticeRequest request = new NoticeRequest("제목", "내용");

        assertThatThrownBy(() -> controller.create(user, request)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.update(user, 3L, request)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ADMIN과_ROOT는_공지를_쓰고_고칠_수_있다() {
        NoticeRequest request = new NoticeRequest("제목", "내용");
        for (Role role : new Role[]{Role.ADMIN, Role.ROOT}) {
            AuthenticatedUser user = loginAs(role);
            assertThatCode(() -> controller.create(user, request)).doesNotThrowAnyException();
            assertThatCode(() -> controller.update(user, 3L, request)).doesNotThrowAnyException();
        }
    }

    @Test
    void ADMIN과_ROOT는_공지를_지울_수_있다() {
        for (Role role : new Role[]{Role.ADMIN, Role.ROOT}) {
            AuthenticatedUser user = loginAs(role);
            assertThatCode(() -> controller.delete(user, 3L)).doesNotThrowAnyException();
        }
    }

    @Test
    void 로그인하지_않으면_호출할_수_없다() {
        assertThatThrownBy(() -> controller.delete(null, 3L))
                .isInstanceOfAny(AuthenticationCredentialsNotFoundException.class, AccessDeniedException.class);
    }
}
