package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PeerStatsResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.PeerStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 같은 티어 유저 기록 API (D53). 로그인한 사용자만 쓴다(내 티어가 기준이라 비로그인은 의미가 없다).
 * 공개 읽기 경로(PublicReadPaths)에 넣지 않았으므로 기본 정책(인증 필요)을 따른다.
 * 사용자 id는 요청에서 받지 않고 토큰에서만 온다. 채보 id는 쉼표로 구분해 한 번에 최대 50개.
 */
@RestController
@RequestMapping("/api/v1/peer-stats")
@RequiredArgsConstructor
public class PeerStatsController {

    private final PeerStatsService peerStatsService;

    @GetMapping
    public PeerStatsResponse get(@AuthenticationPrincipal AuthenticatedUser user,
                                 @RequestParam("chartIds") List<Long> chartIds) {
        return peerStatsService.stats(user.id(), chartIds);
    }
}
