package com.srpfreaks.backend.config;

import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.common.error.JsonErrorWriter;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.security.JwtAuthenticationFilter;
import com.srpfreaks.backend.security.JwtTokenProvider;
import com.srpfreaks.backend.security.PublicReadPaths;
import com.srpfreaks.backend.security.PublicReadRateLimitFilter;
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
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
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
 * 필터 순서: CORS → (RateLimit: 로그인·재발급·로그아웃 각각) → JWT 인증 → 권한 검사.
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
        // 요청 제한은 IP 기준이라, 오락실 Wi-Fi나 이동통신 공용 IP처럼 한 주소를 여러 사람이 쓰면 서로 영향을 준다.
        // 그래서 무차별 대입 대상인 로그인(/google)만 엄격하게(기본 10회/분) 막고, 화면을 열 때마다 불리는
        // 재발급(/refresh)과 로그아웃은 넉넉하게(기본 60회/분) 둔다. 필터마다 제한기를 따로 써서 횟수가 섞이지 않는다.
        PublicReadRateLimitFilter publicReadRateLimit = new PublicReadRateLimitFilter(
                new RateLimiter(appProperties.getRateLimit().getPublicReadPerMinute(), clock), clock);
        RateLimitFilter loginRateLimit = new RateLimitFilter(
                new RateLimiter(appProperties.getRateLimit().getAuthPerMinute(), clock), clock, "/api/v1/auth/google");
        RateLimitFilter refreshRateLimit = new RateLimitFilter(
                new RateLimiter(appProperties.getRateLimit().getRefreshPerMinute(), clock), clock, "/api/v1/auth/refresh");
        RateLimitFilter logoutRateLimit = new RateLimitFilter(
                new RateLimiter(appProperties.getRateLimit().getRefreshPerMinute(), clock), clock, "/api/v1/auth/logout");
        // 사진 인식(D55): 외부 AI 비용이 드는 경로라 주간 한도와 별개로 짧은 시간의 몰림을 막는다
        RateLimitFilter recognizeRateLimit = new RateLimitFilter(
                new RateLimiter(appProperties.getRateLimit().getRecognizePerMinute(), clock), clock, "/api/v1/records/recognize");

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
                // 공개 API 경로는 이 세 개뿐이다. 로그인 전에 불러야 하기 때문이다.
                .requestMatchers(HttpMethod.POST,
                        "/api/v1/auth/google", "/api/v1/auth/refresh", "/api/v1/auth/logout").permitAll()
                // 로그인 없이 읽는 공개 경로(D43): 공지, 곡 목록·상세, 서열표, 유저 목록의 GET만. 목록은 PublicReadPaths 한 곳에 있다.
                // 쓰기와 개인 데이터(내 기록, 레이팅, 세트리스트, 건의)는 아래 /api/v1/** 규칙대로 로그인이 필요하다.
                .requestMatchers(PublicReadPaths::matches).permitAll()
                // 헬스체크(서버 생존 여부만 응답한다). 운영에서는 nginx가 바깥 요청을 막고 내부(Docker)만 부른다
                .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                // 가져오기 기능을 닫아 둘 때(app.import-api.enabled=false)에는 사이트 화면용 미리보기·저장(/record-imports)을 ROOT만 할 수 있다(문제가 생겼을 때 되돌리는 스위치).
                .requestMatchers(request -> !appProperties.getImportApi().isEnabled() && isImportRootGatedPath(request.getRequestURI()))
                        .hasRole("ROOT")
                // 관리 API는 주소 단계에서도 ADMIN 이상으로 막는다(방어를 한 겹 더). 컨트롤러의 @PreAuthorize를 깜빡해도 일반 사용자에게 열리지 않는다.
                // 더 높은 권한(ROOT 전용)이 필요한 곳은 각 메서드의 @PreAuthorize가 계속 맡는다.
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/**").authenticated()
                // 그 밖의 모든 경로(/error, 문서 경로 포함)는 막는다
                .anyRequest().denyAll())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            // 비로그인 공개 읽기 제한은 JWT 필터 뒤에 둔다(로그인 여부를 본 다음에 판단해야 한다)
            .addFilterAfter(publicReadRateLimit, JwtAuthenticationFilter.class)
            .addFilterBefore(loginRateLimit, JwtAuthenticationFilter.class)
            .addFilterBefore(refreshRateLimit, JwtAuthenticationFilter.class)
            .addFilterBefore(logoutRateLimit, JwtAuthenticationFilter.class)
            .addFilterBefore(recognizeRateLimit, JwtAuthenticationFilter.class);

        return http.build();
    }

    /**
     * 사이트 화면용 미리보기·저장(`/record-imports`, D40) 경로.
     * 기능을 닫아 둘 때(app.import-api.enabled=false)에는 ROOT만 부를 수 있다.
     */
    static boolean isImportRootGatedPath(String uri) {
        return uri.startsWith(RECORD_IMPORT_PREFIX);
    }

    static final String RECORD_IMPORT_PREFIX = "/api/v1/record-imports/";

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
    public static RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.fromHierarchy("""
                ROLE_ROOT > ROLE_ADMIN
                ROLE_ADMIN > ROLE_USER
                """);
    }

    /** @PreAuthorize(hasRole 등)에도 같은 계층을 적용한다. static이어야 설정 클래스보다 먼저 만들어진다. */
    @Bean
    public static MethodSecurityExpressionHandler methodSecurityExpressionHandler(RoleHierarchy roleHierarchy) {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        handler.setRoleHierarchy(roleHierarchy);
        return handler;
    }

    /**
     * 아무도 찾지 못하는 UserDetailsService. 이 서비스는 비밀번호 로그인이 없다(Google 로그인 + JWT, D19).
     * 이 빈이 없으면 Spring Boot가 임시 비밀번호가 담긴 기본 사용자(user)를 자동으로 만들고 시작할 때
     * "Using generated security password" 경고를 남긴다. 빈을 직접 두면 자동 생성이 물러난다.
     */
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("비밀번호 로그인은 지원하지 않습니다.");
        };
    }
}
