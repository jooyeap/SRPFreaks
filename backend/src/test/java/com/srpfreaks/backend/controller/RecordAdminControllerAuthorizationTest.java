package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RecordAdminService;
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
 * 관리자 기록 삭제 API의 권한 (D29): USER는 403(AccessDenied), ADMIN·ROOT는 통과(RoleHierarchy), 비로그인은 호출 불가.
 * SongControllerAuthorizationTest와 같은 방식(메서드 보안 + 실제 RoleHierarchy만 띄운다).
 */
class RecordAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean RecordAdminService recordAdminService() { return Mockito.mock(RecordAdminService.class); }

        @Bean RecordAdminController recordAdminController(RecordAdminService service) {
            return new RecordAdminController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private RecordAdminController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(RecordAdminController.class);
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
    void USER는_기록을_지울_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);

        assertThatThrownBy(() -> controller.deleteChartRecords(user, 7L, 10L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ADMIN과_ROOT는_기록을_지울_수_있다() {
        for (Role role : new Role[]{Role.ADMIN, Role.ROOT}) {
            AuthenticatedUser user = loginAs(role);
            assertThatCode(() -> controller.deleteChartRecords(user, 7L, 10L)).doesNotThrowAnyException();
        }
    }

    @Test
    void 로그인하지_않으면_호출할_수_없다() {
        assertThatThrownBy(() -> controller.deleteChartRecords(null, 7L, 10L))
                .isInstanceOfAny(AuthenticationCredentialsNotFoundException.class, AccessDeniedException.class);
    }
}
