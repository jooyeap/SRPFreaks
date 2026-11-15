package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.DashboardResponse.Dashboard;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 대시보드 API (D80, ROOT 전용). 읽기 전용이고 공개 읽기 경로(PublicReadPaths)에 넣지 않았다.
 * 권한은 세 겹이다: 주소 규칙(/api/v1/admin/dashboard → ROOT, SecurityConfig), 이 클래스의 @PreAuthorize("hasRole('ROOT')"), 서비스의 DB 역할 확인.
 * USER·ADMIN은 403, 비로그인은 401이다. 개인이 드러나는 값(이메일·닉네임·개인 기록)은 응답에 없다. 감사 로그는 쓰지 않는다(읽기 전용 조회).
 *
 * days는 7 / 30 / 90만 받는다(서비스의 화이트리스트, 그 밖의 값은 400). 값을 주지 않으면 7이다.
 * 문자열로 받는 이유: 숫자가 아닌 값도 같은 400 응답으로 한 곳에서 처리하려는 것이다.
 */
@RestController
@RequestMapping("/api/v1/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ROOT')")
public class DashboardAdminController {

    private final DashboardService dashboardService;

    @GetMapping
    public Dashboard dashboard(@AuthenticationPrincipal AuthenticatedUser actor, @RequestParam(required = false) String days) {
        return dashboardService.dashboard(actor.id(), days);
    }
}
