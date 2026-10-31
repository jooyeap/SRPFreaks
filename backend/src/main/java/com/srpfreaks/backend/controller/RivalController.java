package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.RivalCompareChartsResponse;
import com.srpfreaks.backend.dto.RivalCompareRatingResponse;
import com.srpfreaks.backend.dto.RivalRecordResponse;
import com.srpfreaks.backend.dto.RivalRequest;
import com.srpfreaks.backend.dto.RivalResponse;
import com.srpfreaks.backend.dto.RivalStatusResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RivalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 라이벌 API (D56). 모두 로그인이 필요하다: PublicReadPaths는 `/players/{id}`까지만 정확히 맞추므로
 * `/players/{id}/compare/...`, `/players/{id}/rival-status`는 공개 경로가 아니다(SecurityConfig의 기본 규칙).
 * 누구의 것인지는 토큰에서만 정한다.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class RivalController {

    private final RivalService rivalService;

    @GetMapping("/rivals")
    public List<RivalResponse> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return rivalService.list(user.id());
    }

    @PostMapping("/rivals")
    public ResponseEntity<Void> register(@AuthenticationPrincipal AuthenticatedUser user,
                                         @Valid @RequestBody RivalRequest request) {
        rivalService.register(user.id(), request.targetUserId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/rivals/{targetUserId}")
    public ResponseEntity<Void> unregister(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long targetUserId) {
        rivalService.unregister(user.id(), targetUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/players/{userId}/rival-status")
    public RivalStatusResponse status(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long userId) {
        return rivalService.status(user.id(), userId);
    }

    @GetMapping("/players/{userId}/compare/rating")
    public RivalCompareRatingResponse compareRating(@AuthenticationPrincipal AuthenticatedUser user,
                                                    @PathVariable Long userId) {
        return rivalService.compareRating(user.id(), userId);
    }

    /** result: WIN / LOSE / TIE / THEIRS_ONLY (그 밖의 값은 400). 비우면 LOSE. */
    @GetMapping("/players/{userId}/compare/charts")
    public RivalCompareChartsResponse compareCharts(@AuthenticationPrincipal AuthenticatedUser user,
                                                    @PathVariable Long userId,
                                                    @RequestParam(required = false) String result,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "" + RivalService.DEFAULT_PAGE_SIZE) int size) {
        return rivalService.compareCharts(user.id(), userId, result, page, size);
    }

    @GetMapping("/song-difficulties/{songDifficultyId}/rival-records")
    public List<RivalRecordResponse> rivalRecords(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @PathVariable Long songDifficultyId) {
        return rivalService.rivalRecords(user.id(), songDifficultyId);
    }
}
