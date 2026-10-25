package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.AuditLogResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.service.AuditLogQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 감사 로그 조회 API. ROOT만 부를 수 있다(ADMIN도 403). */
@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ROOT')")
public class AuditLogController {

    private final AuditLogQueryService auditLogQueryService;

    @GetMapping
    public PageResponse<AuditLogResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + AuditLogQueryService.DEFAULT_PAGE_SIZE) int size,
            // 작업 종류(예: NICKNAME_CHANGE). 비우면 전체
            @RequestParam(required = false) String action,
            // 검색어: 로그 내용(닉네임 변경의 이전·새 닉네임 포함), 대상 번호, 작업한 사람·대상 사용자의 닉네임. 비우면 전체
            @RequestParam(required = false) String q) {
        return auditLogQueryService.list(page, size, action, q);
    }
}
