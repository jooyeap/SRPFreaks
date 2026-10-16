package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.AdminSuggestionResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SuggestionCountResponse;
import com.srpfreaks.backend.dto.SuggestionReviewRequest;
import com.srpfreaks.backend.entity.SuggestionCategory;
import com.srpfreaks.backend.entity.SuggestionStatus;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SuggestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 건의 관리 API (D35, ROOT·ADMIN). 클래스 전체에 hasRole('ADMIN')을 걸어 USER는 403이다(RoleHierarchy로 ROOT도 통과).
 * category/status 파라미터는 enum으로 바로 받는다(없는 값이면 400이라 정렬·필터에 임의 문자열이 들어갈 수 없다).
 */
@RestController
@RequestMapping("/api/v1/admin/suggestions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SuggestionAdminController {

    private final SuggestionService suggestionService;

    @GetMapping
    public PageResponse<AdminSuggestionResponse> list(
            @RequestParam(required = false) SuggestionCategory category,
            @RequestParam(required = false) SuggestionStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + SuggestionService.DEFAULT_PAGE_SIZE) int size) {
        return suggestionService.listAll(category, status, page, size);
    }

    @GetMapping("/received-count")
    public SuggestionCountResponse receivedCount() {
        return suggestionService.countReceived();
    }

    @PatchMapping("/{suggestionId}")
    public AdminSuggestionResponse review(@AuthenticationPrincipal AuthenticatedUser actor,
                                          @PathVariable Long suggestionId,
                                          @Valid @RequestBody SuggestionReviewRequest request) {
        return suggestionService.review(actor.id(), suggestionId, request);
    }
}
