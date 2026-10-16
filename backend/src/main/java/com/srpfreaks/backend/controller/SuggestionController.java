package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SuggestionRequest;
import com.srpfreaks.backend.dto.SuggestionResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SuggestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 건의 보내기와 내 건의 목록 (D35). 로그인한 사용자(USER+)만 부를 수 있다(SecurityConfig의 /api/v1/** 규칙). */
@RestController
@RequestMapping("/api/v1/suggestions")
@RequiredArgsConstructor
public class SuggestionController {

    private final SuggestionService suggestionService;

    @PostMapping
    public ResponseEntity<SuggestionResponse> create(@AuthenticationPrincipal AuthenticatedUser user,
                                                     @Valid @RequestBody SuggestionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(suggestionService.create(user.id(), request));
    }

    @GetMapping("/me")
    public PageResponse<SuggestionResponse> mine(@AuthenticationPrincipal AuthenticatedUser user,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "" + SuggestionService.DEFAULT_PAGE_SIZE) int size) {
        return suggestionService.listMine(user.id(), page, size);
    }
}
