package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.ChartSort;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RateFolderListResponse;
import com.srpfreaks.backend.dto.TableEntryResponse;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.RateBucket;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RateFolderService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

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

    /** 서열표 기준 난이도별로 내 기록을 달성률 구간으로 나눈 개수. 표가 없으면 404. */
    @GetMapping("/tier-rate-folders")
    public RateFolderListResponse tierRateFolders(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @RequestParam Long tableId) {
        return rateFolderService.tierFolders(user.id(), tableId);
    }

    /**
     * 서열표 난이도 폴더 안의 채보 목록(페이지). 잘못된 enum 값(part, rateBucket, sort)은 스프링이 400으로 응답한다.
     * 레벨 폴더 안의 목록은 기존 GET /api/v1/songs/charts의 rateBucket·sort 파라미터로 받는다.
     */
    @GetMapping("/tier-rate-folders/charts")
    public PageResponse<TableEntryResponse> tierRateFolderCharts(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam Long tableId,
            @RequestParam BigDecimal tier,
            @RequestParam(required = false) RateBucket rateBucket,
            @RequestParam(required = false) InstrumentPart part,
            @RequestParam(required = false) ChartSort sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + RateFolderService.DEFAULT_PAGE_SIZE) int size) {
        return rateFolderService.tierCharts(user.id(), tableId, tier, rateBucket, part, sort, page, size);
    }
}
