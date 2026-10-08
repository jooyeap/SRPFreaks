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
            @RequestParam(defaultValue = "" + AuditLogQueryService.DEFAULT_PAGE_SIZE) int size) {
        return auditLogQueryService.list(page, size);
    }
}
