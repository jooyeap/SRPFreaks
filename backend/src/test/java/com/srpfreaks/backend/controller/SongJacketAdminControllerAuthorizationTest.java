package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.dto.SongJacketMatchRequest;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongJacketAdminService;
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

/**
 * 재킷 API(D54) 권한: 매칭·저장은 ROOT만(ADMIN도 403), 내리기는 ADMIN·ROOT(USER는 403).
 * NoticeAdminControllerAuthorizationTest와 같은 방식(메서드 보안 + 실제 RoleHierarchy만 띄운다).
 */
class SongJacketAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean SongJacketAdminService songJacketAdminService() { return Mockito.mock(SongJacketAdminService.class); }

        @Bean SongJacketAdminController songJacketAdminController(SongJacketAdminService service) {
            return new SongJacketAdminController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private SongJacketAdminController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(SongJacketAdminController.class);
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
    void ADMIN은_매칭과_저장을_할_수_없다() {
        AuthenticatedUser admin = loginAs(Role.ADMIN);

        assertThatThrownBy(() -> controller.match(new SongJacketMatchRequest(List.of("A"))))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.save(admin, List.of(1L), List.of())).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ROOT는_매칭할_수_있다() {
        loginAs(Role.ROOT);

        assertThatCode(() -> controller.match(new SongJacketMatchRequest(List.of("A")))).doesNotThrowAnyException();
    }

    @Test
    void USER는_내릴_수_없고_ADMIN은_내릴_수_있다() {
        AuthenticatedUser user = loginAs(Role.USER);
        assertThatThrownBy(() -> controller.delete(user, 3L)).isInstanceOf(AccessDeniedException.class);

        AuthenticatedUser admin = loginAs(Role.ADMIN);
        assertThatCode(() -> controller.delete(admin, 3L)).doesNotThrowAnyException();
    }
}
