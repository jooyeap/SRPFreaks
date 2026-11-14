package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.ChartStatsService;
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
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 서열표 분석 API(D77)의 권한: USER는 403(AccessDenied), ADMIN·ROOT는 통과(RoleHierarchy), 비로그인은 호출 불가.
 * 여섯 개 엔드포인트를 모두 확인한다(클래스에 걸린 @PreAuthorize가 메서드마다 적용되는지).
 * TableEntryAdminControllerAuthorizationTest와 같은 방식(메서드 보안 + 실제 RoleHierarchy만 띄운다).
 */
class ChartStatsAdminControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean ChartStatsService chartStatsService() { return Mockito.mock(ChartStatsService.class); }

        @Bean ChartStatsAdminController chartStatsAdminController(ChartStatsService service) {
            return new ChartStatsAdminController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private ChartStatsAdminController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(ChartStatsAdminController.class);
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

    /** 여섯 엔드포인트를 모두 한 번씩 부르는 동작들. */
    private List<Consumer<AuthenticatedUser>> calls() {
        return List.of(
                u -> controller.deviation(u, null, 0, 20),
                u -> controller.popularity(u, null, 0, 20),
                u -> controller.folders(u, 0, 100),
                u -> controller.undecided(u, 0, 20),
                u -> controller.summary(u, 10L),
                u -> controller.players(u, 10L, null, 0, 20));
    }

    @Test
    void USER는_어느_조회도_할_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);

        for (Consumer<AuthenticatedUser> call : calls()) {
            assertThatThrownBy(() -> call.accept(user)).isInstanceOf(AccessDeniedException.class);
        }
    }

    @Test
    void ADMIN과_ROOT는_모든_조회를_할_수_있다() {
        for (Role role : new Role[]{Role.ADMIN, Role.ROOT}) {
            AuthenticatedUser user = loginAs(role);
            for (Consumer<AuthenticatedUser> call : calls()) {
                assertThatCode(() -> call.accept(user)).doesNotThrowAnyException();
            }
        }
    }

    @Test
    void 로그인하지_않으면_호출할_수_없다() {
        for (Consumer<AuthenticatedUser> call : calls()) {
            assertThatThrownBy(() -> call.accept(null))
                    .isInstanceOfAny(AuthenticationCredentialsNotFoundException.class, AccessDeniedException.class);
        }
    }
}
