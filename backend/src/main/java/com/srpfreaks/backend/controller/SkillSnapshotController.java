package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SkillSnapshotResponse;
import com.srpfreaks.backend.dto.SkillSnapshotStatusResponse;
import com.srpfreaks.backend.dto.SnapshotCompareResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SkillSnapshotCompareService;
import com.srpfreaks.backend.service.SkillSnapshotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 레이팅 스냅샷 API (D32). 경로가 /me이고 사용자 id를 요청에서 받지 않는다(본인 것만).
 * 하루 1회·변경 없음 검사는 서비스가 한다.
 */
@RestController
@RequestMapping("/api/v1/skills/me/snapshots")
@RequiredArgsConstructor
public class SkillSnapshotController {

    private final SkillSnapshotService snapshotService;
    private final SkillSnapshotCompareService compareService;

    @GetMapping
    public PageResponse<SkillSnapshotResponse> list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return snapshotService.list(user.id(), page, size);
    }

    @GetMapping("/status")
    public SkillSnapshotStatusResponse status(@AuthenticationPrincipal AuthenticatedUser user) {
        return snapshotService.status(user.id());
    }

    /** 고른 스냅샷을 바로 이전 스냅샷과 비교한다(오른 곡·새로 들어온 곡·밀려난 곡). */
    @GetMapping("/{snapshotId}/compare")
    public SnapshotCompareResponse compare(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long snapshotId) {
        return compareService.compareWithPrevious(user.id(), snapshotId);
    }

    /** 가장 최근 스냅샷과 지금(계산한 현재 레이팅)을 비교한다. */
    @GetMapping("/compare-current")
    public SnapshotCompareResponse compareCurrent(@AuthenticationPrincipal AuthenticatedUser user) {
        return compareService.compareLatestWithCurrent(user.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SkillSnapshotResponse create(@AuthenticationPrincipal AuthenticatedUser user) {
        return snapshotService.create(user.id());
    }
}
