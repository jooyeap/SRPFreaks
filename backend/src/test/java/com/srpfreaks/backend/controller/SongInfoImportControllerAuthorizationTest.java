package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.dto.SongInfoCommitRequest;
import com.srpfreaks.backend.dto.SongInfoImportRequest;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongInfoImportService;
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
 * 곡 정보 가져오기 API(D90) 권한: 미리보기·저장 모두 ROOT만(ADMIN·USER는 403).
 * SongJacketAdminControllerAuthorizationTest와 같은 방식(메서드 보안 + 실제 RoleHierarchy만 띄운다).
 */
class SongInfoImportControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean SongInfoImportService songInfoImportService() { return Mockito.mock(SongInfoImportService.class); }

        @Bean SongInfoImportController songInfoImportController(SongInfoImportService service) {
            return new SongInfoImportController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private SongInfoImportController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(SongInfoImportController.class);
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

    private static SongInfoImportRequest previewRequest() {
        return new SongInfoImportRequest(List.of());
    }

    private static SongInfoCommitRequest commitRequest() {
        return new SongInfoCommitRequest(List.of(), List.of());
    }

    @Test
    void USER는_미리보기도_저장도_할_수_없다() {
        AuthenticatedUser user = loginAs(Role.USER);

        assertThatThrownBy(() -> controller.preview(previewRequest())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.commit(user, commitRequest())).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ADMIN도_미리보기와_저장을_할_수_없다() {
        AuthenticatedUser admin = loginAs(Role.ADMIN);

        assertThatThrownBy(() -> controller.preview(previewRequest())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.commit(admin, commitRequest())).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ROOT는_미리보기와_저장을_할_수_있다() {
        AuthenticatedUser root = loginAs(Role.ROOT);

        assertThatCode(() -> controller.preview(previewRequest())).doesNotThrowAnyException();
        assertThatCode(() -> controller.commit(root, commitRequest())).doesNotThrowAnyException();
    }
}
