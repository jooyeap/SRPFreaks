package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.SongRankingResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongRankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 곡별 순위 (D74). 읽기 전용이고 **로그인한 사용자에게만** 열린다(공개 읽기 경로 PublicReadPaths에 넣지 않았다 -> 인증이 필요하다).
 * 공개 유저의 곡별 달성률은 D56(2)처럼 로그인한 사용자에게만 보이기 때문이다.
 *
 * 요청 값: 채보 id(경로), page·size(쿼리). 정렬은 서버가 고정하고 사용자 id는 받지 않는다(내 순위 me는 토큰의 사용자 기준).
 * 요약 카드는 같은 API를 size=3으로 부른다. size 상한은 50이다.
 */
@RestController
@RequestMapping("/api/v1/difficulties/{songDifficultyId}")
@RequiredArgsConstructor
public class SongRankingController {

    private final SongRankingService rankingService;

    @GetMapping("/ranking")
    public SongRankingResponse ranking(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long songDifficultyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + SongRankingService.DEFAULT_PAGE_SIZE) int size) {
        return rankingService.ranking(user.id(), songDifficultyId, page, size);
    }
}
