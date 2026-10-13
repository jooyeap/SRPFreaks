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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoticeServiceTest {

    @Mock NoticeRepository noticeRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    NoticeService service;

    @BeforeEach
    void setUp() {
        service = new NoticeService(noticeRepository, auditLogRepository, userRepository);
    }

    private Notice notice(long id, String title, String content) {
        Notice notice = Notice.create(null, title, content);
        ReflectionTestUtils.setField(notice, "id", id);
        return notice;
    }

    private AuditLog savedAudit() {
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void 목록은_받은_페이지를_응답_형식으로_바꾼다() {
        when(noticeRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(notice(2L, "둘", "내용2"), notice(1L, "하나", "내용1"))));

        PageResponse<NoticeResponse> result = service.list(0, 10);

        assertThat(result.content()).extracting(NoticeResponse::title).containsExactly("둘", "하나");
        assertThat(result.totalElements()).isEqualTo(2);
    }

    @Test
    void 잘못된_page와_size는_허용_범위로_맞춘다() {
        when(noticeRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        service.list(-5, 9999);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(noticeRepository).findAllByOrderByCreatedAtDescIdDesc(captor.capture());
        assertThat(captor.getValue().getPageNumber()).isZero();
        assertThat(captor.getValue().getPageSize()).isEqualTo(NoticeService.MAX_PAGE_SIZE);
    }

    @Test
    void 쓰면_저장하고_감사_로그를_남긴다() {
        when(noticeRepository.save(any(Notice.class))).thenAnswer(inv -> {
            Notice saved = inv.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 9L);
            return saved;
        });

        NoticeResponse response = service.create(1L, new NoticeRequest(" 제목 ", "내용"));

        assertThat(response.id()).isEqualTo(9L);
        assertThat(response.title()).isEqualTo("제목");
        AuditLog log = savedAudit();
        assertThat(log.getAction()).isEqualTo("NOTICE_CREATE");
        assertThat(log.getTargetType()).isEqualTo("NOTICE");
        assertThat(log.getTargetId()).isEqualTo("9");
        assertThat(log.getDetail()).containsEntry("title", "제목").doesNotContainKey("content");
    }

    @Test
    void 고치면_값이_바뀌고_감사_로그를_남긴다() {
        Notice existing = notice(3L, "이전", "이전 내용");
        when(noticeRepository.findById(3L)).thenReturn(Optional.of(existing));

        NoticeResponse response = service.update(1L, 3L, new NoticeRequest("새 제목", "새 내용"));

        assertThat(response.title()).isEqualTo("새 제목");
        assertThat(existing.getContent()).isEqualTo("새 내용");
        assertThat(savedAudit().getAction()).isEqualTo("NOTICE_UPDATE");
    }

    @Test
    void 없는_공지를_고치거나_지우면_404이고_아무것도_남기지_않는다() {
        when(noticeRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(1L, 99L, new NoticeRequest("t", "c")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        assertThatThrownBy(() -> service.delete(1L, 99L))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(noticeRepository, never()).delete(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 지우면_삭제하고_감사_로그를_남긴다() {
        Notice existing = notice(3L, "제목", "내용");
        when(noticeRepository.findById(3L)).thenReturn(Optional.of(existing));

        service.delete(1L, 3L);

        verify(noticeRepository).delete(existing);
        AuditLog log = savedAudit();
        assertThat(log.getAction()).isEqualTo("NOTICE_DELETE");
        assertThat(log.getTargetId()).isEqualTo("3");
    }
}
