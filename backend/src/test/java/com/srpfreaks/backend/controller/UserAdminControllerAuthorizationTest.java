package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.dto.RoleChangeRequest;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.UserAdminService;
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

/** 사용자 목록·역할 변경은 ROOT만: USER·ADMIN은 403(AccessDenied), ROOT는 통과. */
class UserAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean UserAdminService userAdminService() { return Mockito.mock(UserAdminService.class); }

        @Bean UserAdminController userAdminController(UserAdminService service) { return new UserAdminController(service); }
    }

    private AnnotationConfigApplicationContext context;
    private UserAdminController controller;
    private final RoleChangeRequest request = new RoleChangeRequest(Role.ADMIN);

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(UserAdminController.class);
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
    void USER와_ADMIN은_사용자_목록을_보거나_역할을_바꿀_수_없다() {
        for (Role role : new Role[]{Role.USER, Role.ADMIN}) {
            AuthenticatedUser user = loginAs(role);
            assertThatThrownBy(() -> controller.list(0, 30)).isInstanceOf(AccessDeniedException.class);
            assertThatThrownBy(() -> controller.changeRole(user, 2L, request)).isInstanceOf(AccessDeniedException.class);
        }
    }

    @Test
    void ROOT는_사용자_목록을_보고_역할을_바꿀_수_있다() {
        AuthenticatedUser user = loginAs(Role.ROOT);
        assertThatCode(() -> controller.list(0, 30)).doesNotThrowAnyException();
        assertThatCode(() -> controller.changeRole(user, 2L, request)).doesNotThrowAnyException();
    }
}
