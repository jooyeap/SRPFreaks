package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.ChartStatsResponse.DeviationRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.FolderRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.Page;
import com.srpfreaks.backend.dto.ChartStatsResponse.PlayerRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.PopularityRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.Summary;
import com.srpfreaks.backend.dto.ChartStatsResponse.UndecidedRow;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.ChartStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서열표 분석 API (D77, ROOT·ADMIN). 읽기 전용이고 공개 읽기 경로(PublicReadPaths)에 넣지 않았다.
 * 권한은 세 겹이다: 주소 규칙(/api/v1/admin/** → ADMIN 이상), 이 클래스의 @PreAuthorize, 서비스의 DB 역할 확인. 일반 USER는 403, 비로그인은 401이다.
 *
 * 정렬 값(sort, range)은 서비스의 화이트리스트로 검사한다(허용 밖 값은 400). 목록은 모두 페이지네이션이다(page, size).
 * 감사 로그는 쓰지 않는다(읽기 전용 조회).
 */
@RestController
@RequestMapping("/api/v1/admin/chart-stats")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ChartStatsAdminController {

    private final ChartStatsService chartStatsService;

    /** 편차 목록. sort = deviation(편차 큰 순, 기본) / avg(평균 높은 순) / players(플레이어 순). */
    @GetMapping("/deviation")
    public Page<DeviationRow> deviation(@AuthenticationPrincipal AuthenticatedUser actor,
                                        @RequestParam(required = false) String sort,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "" + ChartStatsService.DEFAULT_PAGE_SIZE) int size) {
        return chartStatsService.deviation(actor.id(), sort, page, size);
    }

    /** 인기 목록. range = all(전체, 기본) / 7d(최근 7일). */
    @GetMapping("/popularity")
    public Page<PopularityRow> popularity(@AuthenticationPrincipal AuthenticatedUser actor,
                                          @RequestParam(required = false) String range,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "" + ChartStatsService.DEFAULT_PAGE_SIZE) int size) {
        return chartStatsService.popularity(actor.id(), range, page, size);
    }

    /** 폴더(기준 난이도)별 평균 목록. 폴더 곡선 그래프가 한 번에 받도록 size 기본값을 최대(100)로 둔다. */
    @GetMapping("/folders")
    public Page<FolderRow> folders(@AuthenticationPrincipal AuthenticatedUser actor,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "" + ChartStatsService.MAX_PAGE_SIZE) int size) {
        return chartStatsService.folders(actor.id(), page, size);
    }

    /** 미정 목록: 서열표 기준 난이도가 없는데 공개 유저 기록이 있는 채보. */
    @GetMapping("/undecided")
    public Page<UndecidedRow> undecided(@AuthenticationPrincipal AuthenticatedUser actor,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "" + ChartStatsService.DEFAULT_PAGE_SIZE) int size) {
        return chartStatsService.undecided(actor.id(), page, size);
    }

    /** 채보 요약(인원·기록 수·평균·중앙값·폴더 평균·편차). */
    @GetMapping("/charts/{songDifficultyId}/summary")
    public Summary summary(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long songDifficultyId) {
        return chartStatsService.summary(actor.id(), songDifficultyId);
    }

    /** 채보별 공개 유저 목록. sort = rate(최고 달성률, 기본) / score(총점) / plays(이 곡 횟수). */
    @GetMapping("/charts/{songDifficultyId}/players")
    public Page<PlayerRow> players(@AuthenticationPrincipal AuthenticatedUser actor,
                                   @PathVariable Long songDifficultyId,
                                   @RequestParam(required = false) String sort,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "" + ChartStatsService.DEFAULT_PAGE_SIZE) int size) {
        return chartStatsService.players(actor.id(), songDifficultyId, sort, page, size);
    }
}
