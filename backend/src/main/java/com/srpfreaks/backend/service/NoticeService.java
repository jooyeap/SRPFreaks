package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.NoticeRequest;
import com.srpfreaks.backend.dto.NoticeResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Notice;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.NoticeRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * 공지사항 (D30). 읽기는 로그인한 모든 사용자, 쓰기·수정·삭제는 ROOT·ADMIN(컨트롤러의 @PreAuthorize).
 * 쓰기는 모두 audit_logs에 남긴다(NOTICE_CREATE / NOTICE_UPDATE / NOTICE_DELETE). 감사 로그에는 제목만 넣고 본문은 넣지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class NoticeService {

    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 50;

    private final NoticeRepository noticeRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /** 최근 순. 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(목록 API 공통 방식). */
    @Transactional(readOnly = true)
    public PageResponse<NoticeResponse> list(int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        return PageResponse.of(noticeRepository.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(pageIndex, pageSize)),
                NoticeResponse::from);
    }

    public NoticeResponse create(Long actorId, NoticeRequest request) {
        Notice notice = noticeRepository.save(
                Notice.create(userRepository.getReferenceById(actorId), request.title(), request.content()));
        audit(actorId, "NOTICE_CREATE", notice);
        return NoticeResponse.from(notice);
    }

    public NoticeResponse update(Long actorId, Long noticeId, NoticeRequest request) {
        Notice notice = noticeRepository.findById(noticeId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        notice.edit(request.title(), request.content());
        audit(actorId, "NOTICE_UPDATE", notice);
        return NoticeResponse.from(notice);
    }

    public void delete(Long actorId, Long noticeId) {
        Notice notice = noticeRepository.findById(noticeId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        noticeRepository.delete(notice);
        audit(actorId, "NOTICE_DELETE", notice);
    }

    private void audit(Long actorId, String action, Notice notice) {
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), action, "NOTICE",
                String.valueOf(notice.getId()), Map.of("title", notice.getTitle())));
    }
}
