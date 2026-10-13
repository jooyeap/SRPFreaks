package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SkillSnapshotResponse;
import com.srpfreaks.backend.dto.SkillSnapshotStatusResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SkillSnapshotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SkillSnapshotResponse create(@AuthenticationPrincipal AuthenticatedUser user) {
        return snapshotService.create(user.id());
    }
}
