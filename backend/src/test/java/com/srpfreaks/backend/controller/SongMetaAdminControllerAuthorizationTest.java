package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.service.SongMetaTodoService;
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

/** 곡 정보 정리 API(D91)의 권한: USER는 403(AccessDenied), ADMIN·ROOT는 통과(RoleHierarchy), 비로그인은 호출 불가. */
class SongMetaAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean SongMetaTodoService songMetaTodoService() { return Mockito.mock(SongMetaTodoService.class); }

        @Bean SongMetaAdminController songMetaAdminController(SongMetaTodoService service) {
            return new SongMetaAdminController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private SongMetaAdminController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(SongMetaAdminController.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    private void loginAs(Role role) {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                "user", null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    @Test
    void USER는_조회할_수_없다() {
        loginAs(Role.USER);
        assertThatThrownBy(() -> controller.todo(null, null, null, 0, 20)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ADMIN과_ROOT는_조회할_수_있다() {
        for (Role role : new Role[]{Role.ADMIN, Role.ROOT}) {
            loginAs(role);
            assertThatCode(() -> controller.todo(null, null, null, 0, 20)).doesNotThrowAnyException();
        }
    }

    @Test
    void 로그인하지_않으면_조회할_수_없다() {
        assertThatThrownBy(() -> controller.todo(null, null, null, 0, 20))
                .isInstanceOfAny(AuthenticationCredentialsNotFoundException.class, AccessDeniedException.class);
    }
}
