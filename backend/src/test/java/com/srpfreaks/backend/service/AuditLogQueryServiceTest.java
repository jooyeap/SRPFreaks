package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.AuditLogResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.AuditLogSearchMapper;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogQueryServiceTest {

    @Mock
    AuditLogRepository auditLogRepository;

    @Mock
    AuditLogSearchMapper searchMapper;

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

    // ---- 작업 종류 필터 + 검색 (ROOT 화면) --------------------------------------------------------------

    @Test
    void 필터가_없으면_검색_쿼리를_부르지_않고_기존_목록을_쓴다() {
        when(auditLogRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class))).thenReturn(Page.empty());

        service.list(0, 30, "  ", "   ");

        verifyNoInteractions(searchMapper);
        verify(auditLogRepository).findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class));
    }

    @Test
    void 필터가_있으면_쿼리가_고른_id_순서대로_돌려준다() {
        // 쿼리는 최신순 id(3, 1, 2)를 준다. IN 조회는 순서를 보장하지 않으므로 서비스가 그 순서로 맞춘다
        when(searchMapper.count("NICKNAME_CHANGE", "%さくら%")).thenReturn(3L);
        when(searchMapper.findIds("NICKNAME_CHANGE", "%さくら%", 30, 0L)).thenReturn(List.of(3L, 1L, 2L));
        User u = actor(5, "あか");
        when(auditLogRepository.findByIdIn(anyCollection())).thenReturn(
                List.of(log(1, u, "NICKNAME_CHANGE"), log(2, u, "NICKNAME_CHANGE"), log(3, u, "NICKNAME_CHANGE")));

        PageResponse<AuditLogResponse> page = service.list(0, 30, "NICKNAME_CHANGE", "さくら");

        assertThat(page.content()).extracting(AuditLogResponse::id).containsExactly(3L, 1L, 2L);
        assertThat(page.totalElements()).isEqualTo(3);
        verify(auditLogRepository, never()).findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class));
    }

    @Test
    void 종류만_있으면_검색어는_거는_조건이_없고_쪽은_offset으로_넘긴다() {
        when(searchMapper.count("SONG_CREATE", null)).thenReturn(70L);
        when(searchMapper.findIds("SONG_CREATE", null, 30, 60L)).thenReturn(List.of());
        // 모든 id가 비면 로그 조회도 하지 않는다

        PageResponse<AuditLogResponse> page = service.list(2, 30, "SONG_CREATE", null);

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isEqualTo(70);
        verify(auditLogRepository, never()).findByIdIn(anyCollection());
    }

    @Test
    void 맞는_로그가_없으면_id_조회도_하지_않는다() {
        when(searchMapper.count(isNull(), eq("%없음%"))).thenReturn(0L);

        PageResponse<AuditLogResponse> page = service.list(0, 30, null, "없음");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isZero();
        verify(searchMapper, never()).findIds(any(), any(), anyInt(), anyLong());
    }

    @Test
    void 검색어의_퍼센트_밑줄_느낌표는_글자_그대로_찾도록_이스케이프한다() {
        assertThat(AuditLogQueryService.likePattern("100%")).isEqualTo("%100!%%");
        assertThat(AuditLogQueryService.likePattern("a_b")).isEqualTo("%a!_b%");
        assertThat(AuditLogQueryService.likePattern("!안녕")).isEqualTo("%!!안녕%");
        assertThat(AuditLogQueryService.likePattern("  さくら  ")).isEqualTo("%さくら%"); // 앞뒤 공백은 뺀다
        assertThat(AuditLogQueryService.likePattern("   ")).isNull();
        assertThat(AuditLogQueryService.likePattern(null)).isNull();
    }

    @Test
    void 너무_긴_검색어와_모양이_틀린_작업_종류는_400이_되는_예외다() {
        assertThatThrownBy(() -> service.list(0, 30, null, "가".repeat(AuditLogQueryService.MAX_QUERY_LENGTH + 1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(0, 30, "SONG_CREATE' OR 1=1 --", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(0, 30, "song_create", null)).isInstanceOf(IllegalArgumentException.class); // 소문자 불가
        assertThat(AuditLogQueryService.normalizeAction(" USER_BLOCK ")).isEqualTo("USER_BLOCK");
        verifyNoInteractions(searchMapper);
    }
}
