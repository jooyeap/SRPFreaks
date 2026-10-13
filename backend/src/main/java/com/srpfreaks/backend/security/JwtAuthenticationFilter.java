package com.srpfreaks.backend.security;

import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.UserRepository;
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
 * Authorization: Bearer 헤더의 Access Token을 확인해 로그인 상태를 만든다.
 *
 * - 토큰이 없거나 잘못됐으면 아무것도 하지 않고 넘긴다. 인증이 필요한 경로는 뒤에서 401로 막힌다.
 *   (여기서 직접 401을 쓰지 않아야 공개 경로가 잘못된 토큰 때문에 막히지 않는다)
 * - 토큰에는 사용자 ID만 있고, 역할과 차단 여부는 요청마다 DB에서 읽는다.
 *   그래서 역할을 바꾸거나 계정을 차단하면 이미 발급된 Access Token에도 바로 반영된다. (요청당 조회 1회가 대가다)
 * - refresh 토큰이나 typ가 다른 토큰은 JwtTokenProvider.parseAccessToken이 걸러 낸다.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final int MAX_HEADER_LENGTH = 2048;

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider, UserRepository userRepository) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX) && header.length() <= MAX_HEADER_LENGTH) {
            jwtTokenProvider.parseAccessToken(header.substring(BEARER_PREFIX.length()).strip())
                    .flatMap(userRepository::findById)
                    .filter(User::isActive)
                    .ifPresent(user -> {
                        var authentication = UsernamePasswordAuthenticationToken.authenticated(
                                new AuthenticatedUser(user.getId(), user.getRole()), null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    });
        }
        chain.doFilter(request, response);
    }
}
