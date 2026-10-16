package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.AdminSuggestionResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SuggestionCountResponse;
import com.srpfreaks.backend.dto.SuggestionRequest;
import com.srpfreaks.backend.dto.SuggestionResponse;
import com.srpfreaks.backend.dto.SuggestionReviewRequest;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Suggestion;
import com.srpfreaks.backend.entity.SuggestionCategory;
import com.srpfreaks.backend.entity.SuggestionStatus;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SuggestionRepository;
import com.srpfreaks.backend.repository.UserRepository;
import jakarta.persistence.criteria.JoinType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * 건의사항 (D35). 보내기·내 목록은 로그인한 사용자, 관리자 목록·처리는 ROOT·ADMIN(컨트롤러의 @PreAuthorize).
 * 내 건의는 userId로만 조회하므로 남의 건의는 애초에 나오지 않는다. 관리자의 처리는 audit_logs에 남기고, 감사 로그에는 제목·상태만 넣는다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SuggestionService {

    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 50;
    /** 도배 방지: 최근 24시간 동안 한 사용자가 보낼 수 있는 건의 수. */
    public static final int DAILY_LIMIT = 5;

    private final SuggestionRepository suggestionRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public SuggestionResponse create(Long userId, SuggestionRequest request) {
        Instant since = Instant.now().minus(Duration.ofHours(24));
        if (suggestionRepository.countByUserIdAndCreatedAtAfter(userId, since) >= DAILY_LIMIT) {
            throw new ApiException(ErrorCode.SUGGESTION_LIMIT);
        }
        Suggestion saved = suggestionRepository.save(Suggestion.create(userRepository.getReferenceById(userId),
                request.category(), request.title(), request.content()));
        return SuggestionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<SuggestionResponse> listMine(Long userId, int page, int size) {
        return PageResponse.of(suggestionRepository.findByUserIdOrderByCreatedAtDescIdDesc(userId, pageRequest(page, size)),
                SuggestionResponse::from);
    }

    /**
     * 관리자 목록. 종류·상태는 선택 필터. 보낸 사람 닉네임이 필요해 목록 쿼리에서만 user를 fetch join 한다
     * (count 쿼리에는 fetch를 붙일 수 없어 결과 타입이 Long인지 보고 건너뛴다).
     */
    @Transactional(readOnly = true)
    public PageResponse<AdminSuggestionResponse> listAll(SuggestionCategory category, SuggestionStatus status,
                                                         int page, int size) {
        Specification<Suggestion> spec = (root, query, cb) -> {
            if (query != null && !Long.class.equals(query.getResultType())) {
                root.fetch("user", JoinType.LEFT);
            }
            var predicate = cb.conjunction();
            if (category != null) {
                predicate = cb.and(predicate, cb.equal(root.get("category"), category));
            }
            if (status != null) {
                predicate = cb.and(predicate, cb.equal(root.get("status"), status));
            }
            return predicate;
        };
        PageRequest pageable = PageRequest.of(Math.max(page, 0), clampSize(size),
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        return PageResponse.of(suggestionRepository.findAll(spec, pageable), AdminSuggestionResponse::from);
    }

    @Transactional(readOnly = true)
    public SuggestionCountResponse countReceived() {
        return new SuggestionCountResponse(suggestionRepository.countByStatus(SuggestionStatus.RECEIVED));
    }

    public AdminSuggestionResponse review(Long actorId, Long suggestionId, SuggestionReviewRequest request) {
        Suggestion suggestion = suggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        suggestion.review(request.status(), request.adminNote());
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), "SUGGESTION_REVIEW",
                "SUGGESTION", String.valueOf(suggestion.getId()),
                Map.of("title", suggestion.getTitle(), "status", suggestion.getStatus().name())));
        return AdminSuggestionResponse.from(suggestion);
    }

    /** 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(목록 API 공통 방식). */
    private static PageRequest pageRequest(int page, int size) {
        return PageRequest.of(Math.max(page, 0), clampSize(size));
    }

    private static int clampSize(int size) {
        return Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
    }
}
