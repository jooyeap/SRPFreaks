package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.dto.DifficultyUpdateRequest;
import com.srpfreaks.backend.dto.SongRequest;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.dto.DifficultyTableRequest;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.service.DifficultyTableService;
import com.srpfreaks.backend.service.DifficultyTableViewService;
import com.srpfreaks.backend.service.SongAdminService;
import com.srpfreaks.backend.service.SongQueryService;
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

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 곡 관리 API의 권한: USER는 403(AccessDenied), ADMIN·ROOT는 통과(RoleHierarchy), 조회는 USER도 가능.
 * 웹 계층 없이 메서드 보안(@PreAuthorize)과 실제 SecurityConfig의 RoleHierarchy만 띄워서 확인한다.
 * (URL 수준의 401/403 응답은 전체 필터 체인이 필요해 통합 테스트로 따로 본다)
 */
class SongControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean SongQueryService songQueryService() { return Mockito.mock(SongQueryService.class); }

        @Bean SongAdminService songAdminService() { return Mockito.mock(SongAdminService.class); }

        @Bean SongController songController(SongQueryService q, SongAdminService a) { return new SongController(q, a); }

        @Bean DifficultyTableService difficultyTableService() { return Mockito.mock(DifficultyTableService.class); }

        @Bean DifficultyTableViewService difficultyTableViewService() {
            return Mockito.mock(DifficultyTableViewService.class);
        }

        @Bean DifficultyTableController difficultyTableController(DifficultyTableService t, DifficultyTableViewService v) {
            return new DifficultyTableController(t, v);
        }

        @Bean DifficultyController difficultyController(SongAdminService a) { return new DifficultyController(a); }
    }

    private AnnotationConfigApplicationContext context;
    private SongController songController;
    private DifficultyController difficultyController;

    private final SongRequest request = new SongRequest("곡", null, null, null, null, null, null, null);

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        songController = context.getBean(SongController.class);
        difficultyController = context.getBean(DifficultyController.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    private AuthenticatedUser loginAs(Role role) {
        AuthenticatedUser user = new AuthenticatedUser(1L, role);
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                user, null, java.util.List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
        return user;
    }

    @Test
    void USER는_곡_관리를_할_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);

        assertThatThrownBy(() -> songController.create(user, request)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> songController.update(user, 1L, request)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> songController.delete(user, 1L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void USER는_채보_관리를_할_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);

        assertThatThrownBy(() -> difficultyController.update(user, 1L,
                new DifficultyUpdateRequest(new BigDecimal("9.00"), null))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> difficultyController.delete(user, 1L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ADMIN과_ROOT는_곡_관리를_할_수_있다() {
        for (Role role : new Role[]{Role.ADMIN, Role.ROOT}) {
            AuthenticatedUser user = loginAs(role);
            assertThatCode(() -> songController.create(user, request)).doesNotThrowAnyException();
            assertThatCode(() -> songController.delete(user, 1L)).doesNotThrowAnyException();
            assertThatCode(() -> difficultyController.delete(user, 1L)).doesNotThrowAnyException();
        }
    }

    @Test
    void 곡_조회는_USER도_할_수_있다() {
        loginAs(Role.USER);

        assertThatCode(() -> songController.search(null, 0, 20, null)).doesNotThrowAnyException();
        assertThatCode(() -> songController.detail(1L)).doesNotThrowAnyException();
    }

    @Test
    void 로그인하지_않으면_관리_메서드를_호출할_수_없다() {
        assertThatThrownBy(() -> songController.delete(null, 1L))
                .isInstanceOfAny(AuthenticationCredentialsNotFoundException.class, AccessDeniedException.class);
    }

    @Test
    void 서열표_목록은_USER도_보지만_만들기는_ADMIN_이상이다() {
        DifficultyTableController tables = context.getBean(DifficultyTableController.class);
        DifficultyTableRequest request = new DifficultyTableRequest("표", null, NoteOption.SUPER_RANDOM_PLUS);

        AuthenticatedUser user = loginAs(Role.USER);
        assertThatCode(tables::list).doesNotThrowAnyException();
        assertThatCode(() -> tables.entries(user, 1L, null, null, null, true, 0, 10)).doesNotThrowAnyException();
        assertThatThrownBy(() -> tables.create(user, request)).isInstanceOf(AccessDeniedException.class);

        for (Role role : new Role[]{Role.ADMIN, Role.ROOT}) {
            AuthenticatedUser privileged = loginAs(role);
            assertThatCode(() -> tables.create(privileged, request)).doesNotThrowAnyException();
        }
    }
}
