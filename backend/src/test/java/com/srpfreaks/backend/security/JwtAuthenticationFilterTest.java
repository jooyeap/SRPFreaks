package com.srpfreaks.backend.security;

import com.srpfreaks.backend.config.JwtProperties;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** "refresh 토큰으로 API 호출 시 거부", 차단된 사용자, 역할의 출처(DB)를 확인한다. */
class JwtAuthenticationFilterTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final Instant T0 = Instant.parse("2026-10-05T00:00:00Z");

    private final UserRepository userRepository = Mockito.mock(UserRepository.class);
    private JwtTokenProvider provider;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret(SECRET);
        props.setIssuer("srpfreaks");
        props.setAccessTokenValidity(900_000L);
        props.setRefreshTokenValidity(1_209_600_000L);
        provider = new JwtTokenProvider(props, Clock.fixed(T0, ZoneOffset.UTC));
        filter = new JwtAuthenticationFilter(provider, userRepository);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private User user(long id, Role role) {
        User user = User.create("sub-" + id, "u" + id + "@example.com", null, role);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Authentication run(String authorizationHeader) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/me");
        if (authorizationHeader != null) {
            request.addHeader("Authorization", authorizationHeader);
        }
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return SecurityContextHolder.getContext().getAuthentication();
    }

    @Test
    void 유효한_access_토큰이면_DB의_역할로_인증한다() throws Exception {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, Role.ADMIN)));

        Authentication auth = run("Bearer " + provider.generateAccessToken(1L));

        assertThat(auth).isNotNull();
        assertThat(((AuthenticatedUser) auth.getPrincipal()).id()).isEqualTo(1L);
        assertThat(auth.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_ADMIN");
    }

    @Test
    void 토큰이_없으면_인증하지_않는다() throws Exception {
        assertThat(run(null)).isNull();
    }

    @Test
    void Bearer_형식이_아니면_인증하지_않는다() throws Exception {
        assertThat(run("Basic abc")).isNull();
    }

    @Test
    void refresh_원문_토큰을_넣으면_인증하지_않는다() throws Exception {
        assertThat(run("Bearer " + RefreshTokenCodec.generate())).isNull();
    }

    @Test
    void typ가_refresh인_JWT는_인증하지_않는다() throws Exception {
        String token = Jwts.builder()
                .issuer("srpfreaks").subject("1").claim("typ", "refresh")
                .issuedAt(Date.from(T0)).expiration(Date.from(T0.plusSeconds(600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();

        assertThat(run("Bearer " + token)).isNull();
    }

    @Test
    void 차단된_사용자는_유효한_토큰이어도_인증하지_않는다() throws Exception {
        User blocked = user(2L, Role.USER);
        blocked.block();
        when(userRepository.findById(2L)).thenReturn(Optional.of(blocked));

        assertThat(run("Bearer " + provider.generateAccessToken(2L))).isNull();
    }

    @Test
    void 삭제된_사용자는_인증하지_않는다() throws Exception {
        when(userRepository.findById(3L)).thenReturn(Optional.empty());

        assertThat(run("Bearer " + provider.generateAccessToken(3L))).isNull();
    }
}
