package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RecordRequest;
import com.srpfreaks.backend.dto.RecordResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.OptionRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
 * 옵션 기록 API. 로그인한 모든 사용자(USER 이상)가 "본인 기록"만 다룬다.
 * 별도 @PreAuthorize가 없는 이유: 역할이 아니라 소유자가 기준이라서다. 인증 여부는 SecurityConfig의
 * deny-all 기본 정책이 막고, 소유자 검증은 서비스(findOwned)가 한다.
 * 어느 메서드도 사용자 id를 요청에서 받지 않는다 (항상 토큰의 사용자).
 */
@RestController
@RequestMapping("/api/v1/records")
@RequiredArgsConstructor
public class RecordController {

    private final OptionRecordService optionRecordService;

    @PostMapping
    public ResponseEntity<RecordResponse> create(@AuthenticationPrincipal AuthenticatedUser user,
                                                 @Valid @RequestBody RecordRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(optionRecordService.create(user.id(), request));
    }

    @GetMapping
    public PageResponse<RecordResponse> list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) NoteOption noteOption,
            @RequestParam(required = false) Long songDifficultyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + OptionRecordService.DEFAULT_PAGE_SIZE) int size,
            @RequestParam(required = false) String sort) {
        return optionRecordService.list(user.id(), noteOption, songDifficultyId, page, size, sort);
    }

    @GetMapping("/{recordId}")
    public RecordResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long recordId) {
        return optionRecordService.get(user.id(), recordId);
    }

    @PutMapping("/{recordId}")
    public RecordResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long recordId,
                                 @Valid @RequestBody RecordRequest request) {
        return optionRecordService.update(user.id(), recordId, request);
    }

    @DeleteMapping("/{recordId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long recordId) {
        optionRecordService.delete(user.id(), recordId);
        return ResponseEntity.noContent().build();
    }
}
