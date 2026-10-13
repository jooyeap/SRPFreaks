package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.AuditLogResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogQueryServiceTest {

    @Mock
    AuditLogRepository auditLogRepository;

    @InjectMocks
    AuditLogQueryService service;

    private AuditLog log(long id, User actor, String action) {
        AuditLog log = AuditLog.record(actor, action, "SONG", "7", Map.of("title", "곡"));
        ReflectionTestUtils.setField(log, "id", id);
        ReflectionTestUtils.setField(log, "createdAt", Instant.parse("2026-10-08T00:00:00Z"));
        return log;
    }

    private User actor(long id, String nickname) {
        User user = User.create("sub-" + id, "a" + id + "@example.com", nickname);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    @Test
    void 목록은_작업한_사람의_id와_닉네임만_내보낸다() {
        when(auditLogRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log(2, actor(5, "ルート"), "SONG_CREATE")), PageRequest.of(0, 30), 1));

        PageResponse<AuditLogResponse> page = service.list(0, 30);

        assertThat(page.content()).singleElement().satisfies(row -> {
            assertThat(row.actorId()).isEqualTo(5L);
            assertThat(row.actorNickname()).isEqualTo("ルート");
            assertThat(row.action()).isEqualTo("SONG_CREATE");
            assertThat(row.detail()).containsEntry("title", "곡");
        });
        assertThat(page.totalElements()).isEqualTo(1);
    }

    @Test
    void 작업한_사람이_탈퇴했으면_actor는_null이다() {
        when(auditLogRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log(1, null, "SONG_DELETE")), PageRequest.of(0, 30), 1));

        AuditLogResponse row = service.list(0, 30).content().get(0);

        assertThat(row.actorId()).isNull();
        assertThat(row.actorNickname()).isNull();
    }

    @Test
    void page와_size는_허용_범위로_맞춘다() {
        when(auditLogRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class))).thenReturn(Page.empty());

        service.list(-3, 100000);
        service.list(2, 0);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(auditLogRepository, org.mockito.Mockito.times(2)).findAllByOrderByCreatedAtDescIdDesc(captor.capture());
        assertThat(captor.getAllValues().get(0)).isEqualTo(PageRequest.of(0, AuditLogQueryService.MAX_PAGE_SIZE));
        assertThat(captor.getAllValues().get(1)).isEqualTo(PageRequest.of(2, 1));
    }
}
