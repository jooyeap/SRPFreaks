package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.NoticeRequest;
import com.srpfreaks.backend.dto.NoticeResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.NoticeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공지사항 쓰기·수정·삭제 API (D30, ROOT·ADMIN).
 * 클래스 전체에 hasRole('ADMIN')을 걸어 USER는 403이다(RoleHierarchy로 ROOT도 통과).
 */
@RestController
@RequestMapping("/api/v1/admin/notices")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class NoticeAdminController {

    private final NoticeService noticeService;

    @PostMapping
    public ResponseEntity<NoticeResponse> create(@AuthenticationPrincipal AuthenticatedUser actor,
                                                 @Valid @RequestBody NoticeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(noticeService.create(actor.id(), request));
    }

    @PutMapping("/{noticeId}")
    public NoticeResponse update(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long noticeId,
                                 @Valid @RequestBody NoticeRequest request) {
        return noticeService.update(actor.id(), noticeId, request);
    }

    @DeleteMapping("/{noticeId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long noticeId) {
        noticeService.delete(actor.id(), noticeId);
        return ResponseEntity.noContent().build();
    }
}
