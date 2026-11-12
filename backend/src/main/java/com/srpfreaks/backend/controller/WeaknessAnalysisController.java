package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.WeaknessAnalysisResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.WeaknessAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지 분석 탭의 약점 분석 (D72). 읽기 전용이고 요청 값이 없다(내 레이팅 목록과 같은 티어 집계로만 계산한다).
 * 사용자 id는 토큰에서만 온다(경로가 /me). 인증이 필요한 경로이며 공개 읽기 경로(PublicReadPaths)에 넣지 않았다.
 */
@RestController
@RequestMapping("/api/v1/skills/me")
@RequiredArgsConstructor
public class WeaknessAnalysisController {

    private final WeaknessAnalysisService weaknessAnalysisService;

    @GetMapping("/weakness")
    public WeaknessAnalysisResponse weakness(@AuthenticationPrincipal AuthenticatedUser user) {
        return weaknessAnalysisService.analyze(user.id());
    }
}
