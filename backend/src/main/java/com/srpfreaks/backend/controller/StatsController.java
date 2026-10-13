package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.RateFolderListResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RateFolderService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지 통계 API(로그인한 모든 사용자). 내 기록을 집계하므로 사용자는 토큰에서만 정한다.
 */
@RestController
@RequestMapping("/api/v1/stats")
@RequiredArgsConstructor
public class StatsController {

    private final RateFolderService rateFolderService;

    /** 레벨 폴더(0.5 단위)별로 내 기록을 달성률 구간으로 나눈 개수. */
    @GetMapping("/level-rate-folders")
    public RateFolderListResponse levelRateFolders(@AuthenticationPrincipal AuthenticatedUser user) {
        return rateFolderService.levelFolders(user.id());
    }
}
