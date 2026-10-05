package com.srpfreaks.backend.config;

import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.common.error.JsonErrorWriter;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.security.JwtAuthenticationFilter;
import com.srpfreaks.backend.security.JwtTokenProvider;
import com.srpfreaks.backend.security.RateLimitFilter;
import com.srpfreaks.backend.security.RateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Clock;
import java.util.List;

/**
 * 보안 설정. 기본 정책은 deny all이고, 공개할 경로만 아래에서 명시적으로 연다.
 *
 * 필터 순서: CORS → (RateLimit) → JWT 인증 → 권한 검사.
 * JwtAuthenticationFilter / RateLimitFilter는 @Component로 만들지 않고 여기서 직접 생성한다.
 * @Component로 두면 스프링 부트가 보안 체인과 별개로 서블릿 필터로 한 번 더 등록해서 두 번 실행되기 때문이다.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtTokenProvider jwtTokenProvider,
                                           UserRepository userRepository,
                                           AppProperties appProperties,
                                           Clock clock) throws Exception {
        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtTokenProvider, userRepository);
        RateLimitFilter rateLimitFilter = new RateLimitFilter(
                new RateLimiter(appProperties.getRateLimit().getAuthPerMinute(), clock), clock);

        http
            // Access Token을 Authorization 헤더로 보내는 stateless API라 세션/CSRF 쿠키를 쓰지 않는다.
            // Refresh 쿠키는 SameSite=Strict + Origin 검사(OriginPolicy)로 보호한다.
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource(appProperties)))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .logout(logout -> logout.disable())
            .requestCache(cache -> cache.disable())
            .headers(headers -> headers
                // API는 JSON만 돌려주므로 어떤 리소스도 로드·삽입하지 못하게 막는다
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy",
                        "camera=(), microphone=(), geolocation=()")))
            .exceptionHandling(ex -> ex
                // 토큰이 없거나 잘못됨 → 401 / 로그인은 했지만 권한 부족 → 403. 같은 공통 형식으로 응답한다.
                .authenticationEntryPoint((request, response, e) ->
                        JsonErrorWriter.write(response, ErrorCode.UNAUTHORIZED, clock.instant()))
                .accessDeniedHandler((request, response, e) ->
                        JsonErrorWriter.write(response, ErrorCode.FORBIDDEN, clock.instant())))
            .authorizeHttpRequests(auth -> auth
                // 공개 경로는 이 세 개뿐이다. 로그인 전에 불러야 하기 때문이다.
                .requestMatchers(HttpMethod.POST,
                        "/api/v1/auth/google", "/api/v1/auth/refresh", "/api/v1/auth/logout").permitAll()
                .requestMatchers("/api/v1/**").authenticated()
                // 그 밖의 모든 경로(/error, 문서 경로 포함)는 막는다
                .anyRequest().denyAll())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(rateLimitFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    /**
     * 허용 Origin은 환경변수 화이트리스트만 쓴다. 와일드카드(*)는 쿠키(credentials)와 함께 쓰면 위험해서 시작할 때 막는다.
     */
    CorsConfigurationSource corsConfigurationSource(AppProperties appProperties) {
        List<String> origins = appProperties.getCors().getAllowedOrigins();
        if (origins.stream().anyMatch(o -> o.contains("*"))) {
            throw new IllegalStateException("CORS 허용 Origin에는 와일드카드(*)를 쓸 수 없습니다.");
        }
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    /** ROOT > ADMIN > USER. 상위 권한은 하위 권한이 가능한 일을 모두 할 수 있다 (D22). */
    @Bean
    static RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.fromHierarchy("""
                ROLE_ROOT > ROLE_ADMIN
                ROLE_ADMIN > ROLE_USER
                """);
    }

    /** @PreAuthorize(hasRole 등)에도 같은 계층을 적용한다. static이어야 설정 클래스보다 먼저 만들어진다. */
    @Bean
    static MethodSecurityExpressionHandler methodSecurityExpressionHandler(RoleHierarchy roleHierarchy) {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        handler.setRoleHierarchy(roleHierarchy);
        return handler;
    }
}
