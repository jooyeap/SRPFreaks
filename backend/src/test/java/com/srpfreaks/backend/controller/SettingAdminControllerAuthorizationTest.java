package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.dto.SettingUpdateRequest;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SettingAdminService;
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

/** 설정 조회·변경은 ROOT만: USER·ADMIN은 403(AccessDenied), ROOT는 통과. */
class SettingAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean SettingAdminService settingAdminService() { return Mockito.mock(SettingAdminService.class); }

        @Bean SettingAdminController settingAdminController(SettingAdminService service) {
            return new SettingAdminController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private SettingAdminController controller;
    private final SettingUpdateRequest request = new SettingUpdateRequest("20");

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(SettingAdminController.class);
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
    void USER와_ADMIN은_설정을_보거나_바꿀_수_없다() {
        for (Role role : new Role[]{Role.USER, Role.ADMIN}) {
            AuthenticatedUser user = loginAs(role);
            assertThatThrownBy(() -> controller.list(0, 50)).isInstanceOf(AccessDeniedException.class);
            assertThatThrownBy(() -> controller.update(user, "rating.list_single", request))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Test
    void ROOT는_설정을_보고_바꿀_수_있다() {
        AuthenticatedUser user = loginAs(Role.ROOT);
        assertThatCode(() -> controller.list(0, 50)).doesNotThrowAnyException();
        assertThatCode(() -> controller.update(user, "rating.list_single", request)).doesNotThrowAnyException();
    }
}
