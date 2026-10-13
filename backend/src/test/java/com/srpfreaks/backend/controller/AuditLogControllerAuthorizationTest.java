package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.AuditLogQueryService;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 감사 로그 조회는 ROOT만: USER·ADMIN은 403(AccessDenied), ROOT는 통과. */
class AuditLogControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean AuditLogQueryService auditLogQueryService() { return Mockito.mock(AuditLogQueryService.class); }

        @Bean AuditLogController auditLogController(AuditLogQueryService service) { return new AuditLogController(service); }
    }

    private AnnotationConfigApplicationContext context;
    private AuditLogController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(AuditLogController.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    private void loginAs(Role role) {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                new AuthenticatedUser(1L, role), null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    @Test
    void USER와_ADMIN은_감사_로그를_볼_수_없다() {
        for (Role role : new Role[]{Role.USER, Role.ADMIN}) {
            loginAs(role);
            assertThatThrownBy(() -> controller.list(0, 30)).isInstanceOf(AccessDeniedException.class);
        }
    }

    @Test
    void ROOT는_감사_로그를_볼_수_있다() {
        loginAs(Role.ROOT);
        assertThatCode(() -> controller.list(0, 30)).doesNotThrowAnyException();
    }
}
