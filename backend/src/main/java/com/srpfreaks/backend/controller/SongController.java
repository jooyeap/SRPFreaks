package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SongDetailResponse;
import com.srpfreaks.backend.dto.SongRequest;
import com.srpfreaks.backend.dto.SongSummaryResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongAdminService;
import com.srpfreaks.backend.service.SongQueryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 곡 API. 조회는 로그인한 모든 사용자(USER 이상), 등록·수정·삭제는 ROOT·ADMIN.
 * hasRole('ADMIN')은 RoleHierarchy 덕분에 ROOT도 통과한다. 서비스에는 권한 검사를 중복으로 두지 않고
 * 이 컨트롤러 경계에서 한 번에 막는다(모든 관리 API가 컨트롤러를 거친다).
 */
@RestController
@RequestMapping("/api/v1/songs")
@RequiredArgsConstructor
public class SongController {

    private final SongQueryService songQueryService;
    private final SongAdminService songAdminService;

    @GetMapping
    public PageResponse<SongSummaryResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + SongQueryService.DEFAULT_PAGE_SIZE) int size,
            @RequestParam(required = false) String sort) {
        return songQueryService.search(q, page, size, sort);
    }

    @GetMapping("/{songId}")
    public SongDetailResponse detail(@PathVariable Long songId) {
        return songQueryService.detail(songId);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SongDetailResponse> create(@AuthenticationPrincipal AuthenticatedUser actor,
                                                     @Valid @RequestBody SongRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(songAdminService.createSong(actor.id(), request));
    }

    @PutMapping("/{songId}")
    @PreAuthorize("hasRole('ADMIN')")
    public SongDetailResponse update(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long songId,
                                     @Valid @RequestBody SongRequest request) {
        return songAdminService.updateSong(actor.id(), songId, request);
    }

    @DeleteMapping("/{songId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long songId) {
        songAdminService.deleteSong(actor.id(), songId);
        return ResponseEntity.noContent().build();
    }
}
