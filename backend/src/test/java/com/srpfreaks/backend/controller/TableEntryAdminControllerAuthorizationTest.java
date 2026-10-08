package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.dto.TableEntryUpdateRequest;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.TableEntryAdminService;
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

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 서열표 값 수정 API의 권한: USER는 403(AccessDenied), ADMIN·ROOT는 통과(RoleHierarchy), 비로그인은 호출 불가.
 * SongControllerAuthorizationTest와 같은 방식(메서드 보안 + 실제 RoleHierarchy만 띄운다).
 */
class TableEntryAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean TableEntryAdminService tableEntryAdminService() { return Mockito.mock(TableEntryAdminService.class); }

        @Bean TableEntryAdminController tableEntryAdminController(TableEntryAdminService service) {
            return new TableEntryAdminController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private TableEntryAdminController controller;
    private final TableEntryUpdateRequest request = new TableEntryUpdateRequest(new BigDecimal("5.8"), "상", "단일");

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(TableEntryAdminController.class);
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
    void USER는_서열표_값을_고칠_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);

        assertThatThrownBy(() -> controller.upsert(user, 1L, 10L, request)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ADMIN과_ROOT는_서열표_값을_고칠_수_있다() {
        for (Role role : new Role[]{Role.ADMIN, Role.ROOT}) {
            AuthenticatedUser user = loginAs(role);
            assertThatCode(() -> controller.upsert(user, 1L, 10L, request)).doesNotThrowAnyException();
        }
    }

    @Test
    void 로그인하지_않으면_호출할_수_없다() {
        assertThatThrownBy(() -> controller.upsert(null, 1L, 10L, request))
                .isInstanceOfAny(AuthenticationCredentialsNotFoundException.class, AccessDeniedException.class);
    }
}
