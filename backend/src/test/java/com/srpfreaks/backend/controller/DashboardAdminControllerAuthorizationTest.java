package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.DashboardService;
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
 * 관리자 대시보드 API(D80)의 권한: ROOT만 통과하고 ADMIN·USER는 403(AccessDenied), 비로그인은 호출 불가.
 * ChartStatsAdminControllerAuthorizationTest와 같은 방식(메서드 보안 + 실제 RoleHierarchy만 띄운다). ADMIN이 막히는지가 핵심이다
 * (RoleHierarchy상 ADMIN이 USER를 포함하지만 ROOT는 포함하지 않는다).
 */
class DashboardAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean DashboardService dashboardService() { return Mockito.mock(DashboardService.class); }

        @Bean DashboardAdminController dashboardAdminController(DashboardService service) {
            return new DashboardAdminController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private DashboardAdminController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(DashboardAdminController.class);
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
    void USER는_조회할_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);

        assertThatThrownBy(() -> controller.dashboard(user, "7")).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ADMIN도_조회할_수_없다() {
        AuthenticatedUser admin = loginAs(Role.ADMIN);

        assertThatThrownBy(() -> controller.dashboard(admin, "7")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.dashboard(admin, null)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ROOT는_조회할_수_있다() {
        AuthenticatedUser root = loginAs(Role.ROOT);

        assertThatCode(() -> controller.dashboard(root, "7")).doesNotThrowAnyException();
        assertThatCode(() -> controller.dashboard(root, "90")).doesNotThrowAnyException();
    }

    @Test
    void 로그인하지_않으면_호출할_수_없다() {
        assertThatThrownBy(() -> controller.dashboard(null, "7"))
                .isInstanceOfAny(AuthenticationCredentialsNotFoundException.class, AccessDeniedException.class);
    }
}
