package com.srpfreaks.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

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
}
