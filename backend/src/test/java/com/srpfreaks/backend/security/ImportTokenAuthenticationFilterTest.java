package com.srpfreaks.backend.security;

import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.service.ImportTokenService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ImportTokenAuthenticationFilterTest {

    private final ImportTokenService service = mock(ImportTokenService.class);
    private final ImportTokenAuthenticationFilter filter = new ImportTokenAuthenticationFilter(service);

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private Authentication run(String uri, String authorization) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        request.setRequestURI(uri);
        if (authorization != null) {
            request.addHeader("Authorization", authorization);
        }
        // 필터가 안에서 만든 인증을 체인 호출 시점에 잡아 둔다(필터 종료 뒤에는 컨텍스트가 유지되므로 그대로 읽어도 된다)
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return SecurityContextHolder.getContext().getAuthentication();
    }

    @Test
    void 유효한_가져오기_토큰이면_ROLE_IMPORT만_가진_인증을_만든다() throws Exception {
        when(service.authenticate("srpi_abc")).thenReturn(Optional.of(5L));

        Authentication auth = run("/api/v1/imports/recent-plays", "Bearer srpi_abc");

        assertThat(auth).isNotNull();
        assertThat(((AuthenticatedUser) auth.getPrincipal()).id()).isEqualTo(5L);
        assertThat(auth.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_IMPORT");
    }

    @Test
    void 틀린_토큰이면_인증을_만들지_않는다() throws Exception {
        when(service.authenticate("srpi_bad")).thenReturn(Optional.empty());

        assertThat(run("/api/v1/imports/recent-plays", "Bearer srpi_bad")).isNull();
    }

    @Test
    void 헤더가_없거나_Bearer가_아니면_인증을_만들지_않는다() throws Exception {
        assertThat(run("/api/v1/imports/recent-plays", null)).isNull();
        assertThat(run("/api/v1/imports/recent-plays", "Basic abc")).isNull();
    }

    @Test
    void 너무_긴_헤더는_토큰_확인_없이_거절한다() throws Exception {
        assertThat(run("/api/v1/imports/recent-plays", "Bearer srpi_" + "a".repeat(300))).isNull();
        verifyNoInteractions(service);
    }

    @Test
    void 앞선_필터의_로그인_상태는_가져오기_경로에서_지운다() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                new AuthenticatedUser(1L, Role.ADMIN), null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));

        assertThat(run("/api/v1/imports/recent-plays", null)).isNull();
    }

    @Test
    void 가져오기_경로가_아니면_아무것도_하지_않는다() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                new AuthenticatedUser(1L, Role.USER), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        Authentication auth = run("/api/v1/users/me", "Bearer srpi_abc");

        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_USER");
        verifyNoInteractions(service);
    }
}
