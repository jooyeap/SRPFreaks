package com.srpfreaks.backend.security;

import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 로그인 없이 읽을 수 있는 API 경로의 단일 목록(공지, 곡, 서열표, 유저 목록).
 * SecurityConfig(permitAll)와 비로그인 요청 제한(PublicReadRateLimitFilter)이 같은 목록을 쓰도록 한 곳에 둔다.
 *
 * - GET만 연다. 쓰기와 개인 데이터(내 기록, 레이팅, 세트리스트, 건의 등)는 계속 로그인이 필요하다.
 * - 경로를 하나씩 정규식으로 정확히 적는다. 접두사로 열면 나중에 같은 접두사 밑에 추가된 관리용 경로까지 열리기 때문이다.
 *   (예: /songs/title-check는 관리자 전용이라 열지 않는다. 숫자 id만 연다.)
 */
public final class PublicReadPaths {

    private static final List<Pattern> PATTERNS = List.of(
            Pattern.compile("^/api/v1/notices(/\\d+)?$"),
            Pattern.compile("^/api/v1/songs(/(suggest|chart-folders|charts|jackets|\\d+(/tier-history)?))?$"),
            Pattern.compile("^/api/v1/players(/\\d+)?$"),
            Pattern.compile("^/api/v1/difficulty-tables(/\\d+/entries)?$"));

    private PublicReadPaths() {
    }

    public static boolean matches(String method, String uri) {
        return "GET".equals(method) && PATTERNS.stream().anyMatch(p -> p.matcher(uri).matches());
    }

    public static boolean matches(HttpServletRequest request) {
        return matches(request.getMethod(), request.getRequestURI());
    }
}
