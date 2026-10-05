package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SkillService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 레이팅 API. 로그인한 사용자가 "본인" 목록만 본다(경로가 /me이고 사용자 id를 요청에서 받지 않는다).
 * 다른 사용자의 레이팅을 보는 기능(랭킹·비교)은 보류 상태라 만들지 않는다 (D15).
 */
@RestController
@RequestMapping("/api/v1/skills")
@RequiredArgsConstructor
public class SkillController {

    private final SkillService skillService;

    @GetMapping("/me")
    public SkillResponse me(@AuthenticationPrincipal AuthenticatedUser user) {
        return skillService.mySkill(user.id());
    }
}
