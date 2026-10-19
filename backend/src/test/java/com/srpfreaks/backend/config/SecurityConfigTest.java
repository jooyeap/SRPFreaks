package com.srpfreaks.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecurityConfigTest {

    private List<String> reachable(String role) {
        RoleHierarchy hierarchy = SecurityConfig.roleHierarchy();
        return hierarchy.getReachableGrantedAuthorities(List.of(new SimpleGrantedAuthority(role))).stream()
                .map(GrantedAuthority::getAuthority).toList();
    }

    @Test
    void ROOT는_ADMIN과_USER_권한을_포함한다() {
        assertThat(reachable("ROLE_ROOT")).contains("ROLE_ROOT", "ROLE_ADMIN", "ROLE_USER");
    }

    @Test
    void ADMIN은_USER를_포함하지만_ROOT는_아니다() {
        assertThat(reachable("ROLE_ADMIN")).contains("ROLE_ADMIN", "ROLE_USER").doesNotContain("ROLE_ROOT");
    }

    @Test
    void USER는_자기_권한만_갖는다() {
        assertThat(reachable("ROLE_USER")).containsExactly("ROLE_USER");
    }

    @Test
    void CORS_허용_Origin에_와일드카드가_있으면_시작하지_못한다() {
        AppProperties props = new AppProperties();
        props.getCors().setAllowedOrigins(List.of("*"));

        assertThatThrownBy(() -> new SecurityConfig().corsConfigurationSource(props))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 가져오기_경로는_공식_사이트_Origin만_쿠키_없이_허용한다() {
        AppProperties props = new AppProperties();
        var config = new SecurityConfig().importCorsConfiguration(props);

        assertThat(config.getAllowedOrigins()).containsExactly("https://p.eagate.573.jp");
        assertThat(config.getAllowCredentials()).isFalse();
        assertThat(config.getAllowedMethods()).containsExactlyInAnyOrder("POST", "OPTIONS");
    }

    @Test
    void 가져오기_허용_Origin에_와일드카드가_있으면_시작하지_못한다() {
        AppProperties props = new AppProperties();
        props.getImportApi().setAllowedOrigins(List.of("*"));

        assertThatThrownBy(() -> new SecurityConfig().importCorsConfiguration(props))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 가져오기_경로의_CORS는_공식_사이트를_허용하고_다른_API는_허용하지_않는다() {
        AppProperties props = new AppProperties();
        props.getCors().setAllowedOrigins(List.of("https://srp.example.com"));
        var source = new SecurityConfig().corsConfigurationSource(props);

        var imports = source.getCorsConfiguration(new MockHttpServletRequest("OPTIONS", "/api/v1/imports/recent-plays"));
        var others = source.getCorsConfiguration(new MockHttpServletRequest("OPTIONS", "/api/v1/users/me"));

        // 같은 Origin(공식 사이트)이 가져오기 경로에서만 통과해야 한다 (등록 순서 회귀 방지)
        assertThat(imports.checkOrigin("https://p.eagate.573.jp")).isEqualTo("https://p.eagate.573.jp");
        assertThat(others.checkOrigin("https://p.eagate.573.jp")).isNull();
        assertThat(others.checkOrigin("https://srp.example.com")).isEqualTo("https://srp.example.com");
        assertThat(imports.checkOrigin("https://srp.example.com")).isNull();
    }

    @Test
    void 가져오기_기능을_모두에게_열기_전_ROOT만_부를_수_있는_경로는_토큰_API뿐이다() {
        assertThat(SecurityConfig.isImportTokenPath("/api/v1/import-token")).isTrue();
        // 가져오기 API는 가져오기 토큰(ROLE_IMPORT)만 받는 별도 규칙이라 여기에 포함하지 않는다
        assertThat(SecurityConfig.isImportTokenPath("/api/v1/imports/recent-plays")).isFalse();
        assertThat(SecurityConfig.isImportTokenPath("/api/v1/users/me")).isFalse();
        assertThat(SecurityConfig.isImportTokenPath("/api/v1/import-token/extra")).isFalse();
    }

    @Test
    void 가져오기_기능은_기본으로_꺼져_있다() {
        assertThat(new AppProperties().getImportApi().isEnabled()).isFalse();
    }
}
