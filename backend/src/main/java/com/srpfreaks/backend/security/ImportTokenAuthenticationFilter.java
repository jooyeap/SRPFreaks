package com.srpfreaks.backend.security;

import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.service.ImportTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * 가져오기 경로(/api/v1/imports/**)에서만 동작해 `Authorization: Bearer srpi_…` 가져오기 토큰으로 사용자를 인증한다.
 *
 * 권한을 일부러 좁힌다: 이 토큰으로 만든 로그인 상태에는 ROLE_IMPORT 하나만 준다(ROLE_USER가 없다).
 * 그래서 이 토큰으로는 가져오기 경로 말고 다른 API(기록 수정, 내 정보 등)를 부를 수 없다(SecurityConfig가 경로별로 요구하는 역할이 다르다).
 * 반대로 로그인(Access) 토큰은 ROLE_IMPORT가 없어서 가져오기 경로에 들어올 수 없다.
 * 토큰이 없거나 틀리면 아무것도 하지 않고 넘긴다 → 인증이 필요한 경로라서 뒤에서 401로 막힌다(이유를 구분해 알려 주지 않는다).
 */
public class ImportTokenAuthenticationFilter extends OncePerRequestFilter {

    public static final String PATH_PREFIX = "/api/v1/imports/";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final int MAX_HEADER_LENGTH = 256;

    private final ImportTokenService importTokenService;

    public ImportTokenAuthenticationFilter(ImportTokenService importTokenService) {
        this.importTokenService = importTokenService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // 앞선 필터(JWT)가 만든 로그인 상태가 있어도 이 경로에서는 가져오기 토큰만 인정한다
        SecurityContextHolder.clearContext();
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX) && header.length() <= MAX_HEADER_LENGTH) {
            importTokenService.authenticate(header.substring(BEARER_PREFIX.length()).strip()).ifPresent(userId -> {
                // role은 principal 모양을 맞추려는 값일 뿐이고, 권한(authorities)에는 ROLE_IMPORT만 넣는다
                var authentication = UsernamePasswordAuthenticationToken.authenticated(
                        new AuthenticatedUser(userId, Role.USER), null,
                        List.of(new SimpleGrantedAuthority("ROLE_IMPORT")));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }
        chain.doFilter(request, response);
    }
}
