package com.srpfreaks.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 비로그인 공개 읽기 목록(D43): 읽기 GET만 정확히 열리고, 쓰기·관리·개인 경로는 열리지 않는다. */
class PublicReadPathsTest {

    @Test
    void 공지_곡_서열표_유저_목록의_GET은_열린다() {
        for (String uri : new String[] {
                "/api/v1/notices", "/api/v1/notices/12",
                "/api/v1/songs", "/api/v1/songs/5", "/api/v1/songs/suggest", "/api/v1/songs/chart-folders", "/api/v1/songs/charts",
                "/api/v1/songs/5/tier-history", "/api/v1/songs/jackets",
                "/api/v1/players", "/api/v1/players/3",
                "/api/v1/difficulty-tables", "/api/v1/difficulty-tables/1/entries"}) {
            assertThat(PublicReadPaths.matches("GET", uri)).as(uri).isTrue();
        }
    }

    @Test
    void GET이_아니면_열리지_않는다() {
        for (String method : new String[] {"POST", "PUT", "PATCH", "DELETE"}) {
            assertThat(PublicReadPaths.matches(method, "/api/v1/songs")).as(method).isFalse();
            assertThat(PublicReadPaths.matches(method, "/api/v1/notices/1")).as(method).isFalse();
        }
    }

    @Test
    void 관리자_개인_경로와_비슷한_이름은_열리지_않는다() {
        for (String uri : new String[] {
                "/api/v1/songs/title-check",          // 관리자 전용
                "/api/v1/songs/5/difficulties", "/api/v1/songs/abc/tier-history", "/api/v1/songs/5/tier-history/1",
                "/api/v1/admin/notices", "/api/v1/admin/songs",
                "/api/v1/users/me", "/api/v1/records", "/api/v1/skill", "/api/v1/setlist", "/api/v1/suggestions",
                "/api/v1/notices/abc", "/api/v1/players/me", "/api/v1/songs/", "/api/v1/songs/5/",
                "/api/v1/difficulty-tables/1", "/api/v1/difficulty-tables/1/entries/9",
                "/api/v1/noticesX", "/api/v1/peer-stats", "/actuator/health", "/error"}) {
            assertThat(PublicReadPaths.matches("GET", uri)).as(uri).isFalse();
        }
    }
}
