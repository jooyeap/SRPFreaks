package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.config.SecurityConfig;
import com.srpfreaks.backend.dto.OfficialSongCommitRequest;
import com.srpfreaks.backend.dto.OfficialSongImportRequest;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.OfficialSongImportService;
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

/** 공식 곡 목록 갱신(D42)은 ROOT만: USER·ADMIN은 403(AccessDenied), ROOT는 통과. */
class OfficialSongImportControllerAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean static RoleHierarchy roleHierarchy() { return SecurityConfig.roleHierarchy(); }

        @Bean static MethodSecurityExpressionHandler handler(RoleHierarchy hierarchy) {
            return SecurityConfig.methodSecurityExpressionHandler(hierarchy);
        }

        @Bean OfficialSongImportService service() { return Mockito.mock(OfficialSongImportService.class); }

        @Bean OfficialSongImportController controller(OfficialSongImportService service) {
            return new OfficialSongImportController(service);
        }
    }

    private AnnotationConfigApplicationContext context;
    private OfficialSongImportController controller;
    private final OfficialSongImportRequest previewRequest = new OfficialSongImportRequest(List.of());
    private final OfficialSongCommitRequest commitRequest = new OfficialSongCommitRequest(List.of(), List.of(), List.of());

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(OfficialSongImportController.class);
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
    void USER와_ADMIN은_미리보기도_반영도_할_수_없다() {
        for (Role role : new Role[]{Role.USER, Role.ADMIN}) {
            AuthenticatedUser user = loginAs(role);
            assertThatThrownBy(() -> controller.preview(previewRequest)).isInstanceOf(AccessDeniedException.class);
            assertThatThrownBy(() -> controller.commit(user, commitRequest)).isInstanceOf(AccessDeniedException.class);
        }
    }

    @Test
    void ROOT는_미리보기와_반영을_할_수_있다() {
        AuthenticatedUser user = loginAs(Role.ROOT);
        assertThatCode(() -> controller.preview(previewRequest)).doesNotThrowAnyException();
        assertThatCode(() -> controller.commit(user, commitRequest)).doesNotThrowAnyException();
    }
}
