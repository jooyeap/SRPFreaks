package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.RivalCompareChartsResponse;
import com.srpfreaks.backend.dto.RivalCompareRatingResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RivalRecordResponse;
import com.srpfreaks.backend.dto.RivalRegistrantResponse;
import com.srpfreaks.backend.dto.RivalRequest;
import com.srpfreaks.backend.dto.RivalResponse;
import com.srpfreaks.backend.dto.RivalStatusResponse;
import com.srpfreaks.backend.dto.RivalSummaryDetailResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RivalService;
import com.srpfreaks.backend.service.RivalSummaryService;
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
    private final RivalSummaryService rivalSummaryService;

    @GetMapping("/rivals")
    public List<RivalResponse> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return rivalService.list(user.id());
    }

    /** 나를 라이벌로 등록한 공개 유저(D63). userId를 받지 않고 토큰의 본인 기준으로만 조회한다. */
    @GetMapping("/rivals/registered-me")
    public PageResponse<RivalRegistrantResponse> registeredMe(@AuthenticationPrincipal AuthenticatedUser user,
                                                              @RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "" + RivalService.DEFAULT_PAGE_SIZE) int size) {
        return rivalService.registeredMe(user.id(), page, size);
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

    /** 라이벌 대시보드 집계(D67): 두 사람이 모두 기록한 전체 곡을 속성별·서열 난이도별로. 상대가 공개 ACTIVE 유저가 아니면 404. */
    @GetMapping("/players/{userId}/compare/summary")
    public RivalSummaryResponse compareSummary(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long userId) {
        return rivalSummaryService.summary(user.id(), userId);
    }

    /**
     * 속성별 곡 목록(D67). key = SINGLE·COMPOUND·COMPOSITE_SINGLE·DOUBLE·TRIPLE, filter = ALL·LOSE·CLOSE·WIN·THEIRS_ONLY(상대만, 2026-11-10),
     * sort = DIFF_ASC·DIFF_DESC·CLOSE·TITLE(비우면 필터에 맞는 기본). 허용 밖의 값은 400.
     */
    @GetMapping("/players/{userId}/compare/summary/{key}")
    public RivalSummaryDetailResponse compareSummaryDetail(@AuthenticationPrincipal AuthenticatedUser user,
                                                           @PathVariable Long userId, @PathVariable String key,
                                                           @RequestParam(required = false) String filter,
                                                           @RequestParam(required = false) String sort,
                                                           @RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "" + RivalSummaryService.DEFAULT_PAGE_SIZE) int size) {
        return rivalSummaryService.detail(user.id(), userId, key, filter, sort, page, size);
    }

    @GetMapping("/song-difficulties/{songDifficultyId}/rival-records")
    public List<RivalRecordResponse> rivalRecords(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @PathVariable Long songDifficultyId) {
        return rivalService.rivalRecords(user.id(), songDifficultyId);
    }
}
