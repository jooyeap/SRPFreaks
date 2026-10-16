package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SuggestionRequest;
import com.srpfreaks.backend.dto.SuggestionResponse;
import com.srpfreaks.backend.dto.SuggestionReviewRequest;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Suggestion;
import com.srpfreaks.backend.entity.SuggestionCategory;
import com.srpfreaks.backend.entity.SuggestionStatus;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SuggestionRepository;
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

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SuggestionServiceTest {

    @Mock SuggestionRepository suggestionRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    SuggestionService service;
    final User user = User.create("sub", "a@example.com", "tester");

    @BeforeEach
    void setUp() {
        service = new SuggestionService(suggestionRepository, auditLogRepository, userRepository);
    }

    private Suggestion suggestion(long id) {
        Suggestion s = Suggestion.create(user, SuggestionCategory.SONG_REQUEST, "곡 추가", "내용");
        ReflectionTestUtils.setField(s, "id", id);
        return s;
    }

    @Test
    void 건의를_보내면_접수_상태로_저장한다() {
        when(suggestionRepository.countByUserIdAndCreatedAtAfter(eq(1L), any(Instant.class))).thenReturn(0L);
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(suggestionRepository.save(any(Suggestion.class))).thenAnswer(inv -> inv.getArgument(0));

        SuggestionResponse response = service.create(1L, new SuggestionRequest(SuggestionCategory.BUG, " 제목 ", "내용"));

        assertThat(response.status()).isEqualTo(SuggestionStatus.RECEIVED);
        assertThat(response.category()).isEqualTo(SuggestionCategory.BUG);
        assertThat(response.title()).isEqualTo("제목");
    }

    @Test
    void 하루_제한에_도달하면_저장하지_않고_429로_거부한다() {
        when(suggestionRepository.countByUserIdAndCreatedAtAfter(eq(1L), any(Instant.class)))
                .thenReturn((long) SuggestionService.DAILY_LIMIT);

        assertThatThrownBy(() -> service.create(1L, new SuggestionRequest(SuggestionCategory.BUG, "제목", "내용")))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.SUGGESTION_LIMIT));
        verify(suggestionRepository, never()).save(any());
    }

    @Test
    void 하루_제한_바로_아래면_보낼_수_있다() {
        when(suggestionRepository.countByUserIdAndCreatedAtAfter(eq(1L), any(Instant.class)))
                .thenReturn((long) SuggestionService.DAILY_LIMIT - 1);
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(suggestionRepository.save(any(Suggestion.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.create(1L, new SuggestionRequest(SuggestionCategory.OTHER, "제목", "내용"))).isNotNull();
    }

    @Test
    void 내_목록은_내_사용자_id로만_조회하고_page_size를_허용_범위로_맞춘다() {
        when(suggestionRepository.findByUserIdOrderByCreatedAtDescIdDesc(eq(7L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(suggestion(1L))));

        PageResponse<SuggestionResponse> page = service.listMine(7L, -3, 1000);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(suggestionRepository).findByUserIdOrderByCreatedAtDescIdDesc(eq(7L), captor.capture());
        assertThat(captor.getValue().getPageNumber()).isZero();
        assertThat(captor.getValue().getPageSize()).isEqualTo(SuggestionService.MAX_PAGE_SIZE);
        assertThat(page.content()).hasSize(1);
    }

    @Test
    void 처리하면_상태와_답변이_바뀌고_감사_로그에_제목과_상태만_남긴다() {
        Suggestion s = suggestion(5L);
        when(suggestionRepository.findById(5L)).thenReturn(Optional.of(s));
        when(userRepository.getReferenceById(9L)).thenReturn(user);

        var response = service.review(9L, 5L, new SuggestionReviewRequest(SuggestionStatus.DONE, "등록했습니다."));

        assertThat(response.status()).isEqualTo(SuggestionStatus.DONE);
        assertThat(response.adminNote()).isEqualTo("등록했습니다.");
        assertThat(response.authorNickname()).isEqualTo("tester");
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        assertThat(captor.getValue().getAction()).isEqualTo("SUGGESTION_REVIEW");
        assertThat(captor.getValue().getDetail()).containsOnlyKeys("title", "status");
    }

    @Test
    void 없는_건의를_처리하면_404이고_감사_로그도_남기지_않는다() {
        when(suggestionRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.review(9L, 404L, new SuggestionReviewRequest(SuggestionStatus.DONE, null)))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 접수_건수는_저장소의_RECEIVED_개수다() {
        when(suggestionRepository.countByStatus(SuggestionStatus.RECEIVED)).thenReturn(3L);

        assertThat(service.countReceived().received()).isEqualTo(3L);
    }
}
