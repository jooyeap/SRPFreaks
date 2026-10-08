package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.AuditLogResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 감사 로그 조회 (ROOT 전용, 읽기 전용). 쓰는 쪽은 각 관리 서비스가 audit_logs에 직접 남긴다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditLogQueryService {

    public static final int DEFAULT_PAGE_SIZE = 30;
    public static final int MAX_PAGE_SIZE = 100;

    private final AuditLogRepository auditLogRepository;

    /** 최근 순. 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(목록 API 공통 방식, PlayerService와 같다). */
    public PageResponse<AuditLogResponse> list(int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        return PageResponse.of(
                auditLogRepository.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(pageIndex, pageSize)),
                AuditLogResponse::from);
    }
}
