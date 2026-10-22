package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.ChartFolderListResponse;
import com.srpfreaks.backend.dto.ChartSort;
import com.srpfreaks.backend.dto.ChartRowResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.RateBucket;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongChartListService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * 전체 곡 목록 화면용 API. 로그인 없이도 읽을 수 있다(D43). 로그인했으면 내 기록을 함께 보여 주고(사용자는 토큰에서만 정한다), 비로그인이면 user가 null이라 기록 없이 곡 정보만 내려간다.
 * 경로가 /songs/{songId}와 겹쳐 보이지만 /chart-folders, /charts는 고정 경로라 그쪽이 먼저 맞는다.
 * 잘못된 enum 값(part, difficulty, rateBucket, sort)은 스프링이 400으로 응답한다.
 */
@RestController
@RequestMapping("/api/v1/songs")
@RequiredArgsConstructor
public class SongChartListController {

    private final SongChartListService songChartListService;

    @GetMapping("/chart-folders")
    public ChartFolderListResponse folders(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) InstrumentPart part,
            @RequestParam(required = false) List<DifficultyType> difficulty,
            @RequestParam(required = false) String version) {
        return songChartListService.folders(user == null ? null : user.id(), q, part, difficulty, version);
    }

    @GetMapping("/charts")
    public PageResponse<ChartRowResponse> charts(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) BigDecimal folder,
            @RequestParam(required = false) BigDecimal folderStep,
            @RequestParam(required = false) InstrumentPart part,
            @RequestParam(required = false) List<DifficultyType> difficulty,
            @RequestParam(required = false) String version,
            @RequestParam(required = false) RateBucket rateBucket,
            @RequestParam(required = false) ChartSort sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + SongChartListService.DEFAULT_PAGE_SIZE) int size) {
        return songChartListService.charts(user == null ? null : user.id(), q, folder, folderStep, part, difficulty, version, rateBucket, sort,
                page, size);
    }
}
