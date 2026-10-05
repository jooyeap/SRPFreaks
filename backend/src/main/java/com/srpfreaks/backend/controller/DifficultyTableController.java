package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.DifficultyTableRequest;
import com.srpfreaks.backend.dto.DifficultyTableResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TierGroupResponse;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.service.DifficultyTableViewService;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.DifficultyTableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 서열표 API. 목록 조회는 로그인한 모든 사용자, 만들기는 ROOT·ADMIN. */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class DifficultyTableController {

    private final DifficultyTableService difficultyTableService;
    private final DifficultyTableViewService difficultyTableViewService;

    @GetMapping("/difficulty-tables")
    public List<DifficultyTableResponse> list() {
        return difficultyTableService.list();
    }

    /** 서열표 화면. 기준 난이도 묶음 단위로 페이지를 나눈다. mine=true면 로그인한 본인의 기록만 연결한다. */
    @GetMapping("/difficulty-tables/{id}/entries")
    public PageResponse<TierGroupResponse> entries(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @RequestParam(required = false) InstrumentPart part,
            @RequestParam(required = false) String recommend,
            @RequestParam(required = false) String pattern,
            @RequestParam(defaultValue = "false") boolean mine,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return difficultyTableViewService.entries(user.id(), id, part, recommend, pattern, mine, page, size);
    }

    @PostMapping("/admin/difficulty-tables")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DifficultyTableResponse> create(@AuthenticationPrincipal AuthenticatedUser actor,
                                                          @Valid @RequestBody DifficultyTableRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(difficultyTableService.create(actor.id(), request));
    }
}
