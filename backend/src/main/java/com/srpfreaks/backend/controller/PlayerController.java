package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.PlayerDetailResponse;
import com.srpfreaks.backend.dto.PlayerSummaryResponse;
import com.srpfreaks.backend.service.PlayerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 유저 목록·상세 API (D26). 로그인한 사용자만 부를 수 있고(SecurityConfig의 /api/v1/** 규칙) 읽기 전용이다.
 * 공개를 켠 유저만 나오고, 응답에는 이메일·역할·Google ID가 없다.
 */
@RestController
@RequestMapping("/api/v1/players")
@RequiredArgsConstructor
public class PlayerController {

    private final PlayerService playerService;

    @GetMapping
    public PageResponse<PlayerSummaryResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + PlayerService.DEFAULT_PAGE_SIZE) int size) {
        return playerService.list(page, size);
    }

    @GetMapping("/{userId}")
    public PlayerDetailResponse detail(@PathVariable Long userId) {
        return playerService.detail(userId);
    }
}
