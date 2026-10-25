package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.AuditLogResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.mapper.AuditLogSearchMapper;
import com.srpfreaks.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** 감사 로그 조회 (ROOT 전용, 읽기 전용). 쓰는 쪽은 각 관리 서비스가 audit_logs에 직접 남긴다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditLogQueryService {

    public static final int DEFAULT_PAGE_SIZE = 30;
    public static final int MAX_PAGE_SIZE = 100;
    /** 검색어 최대 길이. 닉네임 한도보다 넉넉하고, 너무 긴 글자로 DB를 부르지 않게 하는 상한이다. */
    public static final int MAX_QUERY_LENGTH = 50;

    /**
     * 작업 종류는 대문자와 밑줄만 받는다(SONG_CREATE 같은 audit_logs.action 값의 모양).
     * 종류 목록을 서버에 따로 두면 새 작업이 생길 때마다 두 곳을 고쳐야 해서, 값의 모양만 검증한다.
     * 값은 #{}로 바인딩되어 SQL 주입은 일어나지 않고, 모르는 종류는 빈 목록이 된다.
     */
    private static final Pattern ACTION_FORMAT = Pattern.compile("^[A-Z_]{1,50}$");

    private final AuditLogRepository auditLogRepository;
    private final AuditLogSearchMapper searchMapper;

    /** 필터 없는 목록(옛 호출과 같다). */
    public PageResponse<AuditLogResponse> list(int page, int size) {
        return list(page, size, null, null);
    }

    /**
     * 최근 순. 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(목록 API 공통 방식, PlayerService와 같다).
     * action(작업 종류)과 q(검색어)는 비어 있으면 걸지 않는다. 모양이 틀린 action이나 너무 긴 q는 400이다.
     * 필터가 하나도 없으면 JPA 목록을, 있으면 MyBatis로 id를 고른 뒤 JPA로 읽는다.
     */
    public PageResponse<AuditLogResponse> list(int page, int size, String action, String q) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        String actionFilter = normalizeAction(action);
        String pattern = likePattern(q);
        PageRequest pageable = PageRequest.of(pageIndex, pageSize);

        if (actionFilter == null && pattern == null) {
            return PageResponse.of(auditLogRepository.findAllByOrderByCreatedAtDescIdDesc(pageable), AuditLogResponse::from);
        }

        long total = searchMapper.count(actionFilter, pattern);
        List<Long> ids = total == 0 ? List.of() : searchMapper.findIds(actionFilter, pattern, pageSize, (long) pageIndex * pageSize);
        // IN 조회는 순서를 보장하지 않으므로 쿼리가 고른 id 순서(최신순)대로 다시 맞춘다
        Map<Long, AuditLog> byId = ids.isEmpty() ? Map.of()
                : auditLogRepository.findByIdIn(ids).stream().collect(Collectors.toMap(AuditLog::getId, Function.identity()));
        List<AuditLog> ordered = ids.stream().map(byId::get).filter(Objects::nonNull).toList();
        return PageResponse.of(new PageImpl<>(ordered, pageable, total), AuditLogResponse::from);
    }

    static String normalizeAction(String action) {
        if (action == null || action.isBlank()) {
            return null;
        }
        String trimmed = action.trim();
        if (!ACTION_FORMAT.matcher(trimmed).matches()) {
            throw new IllegalArgumentException("작업 종류 형식이 올바르지 않습니다.");
        }
        return trimmed;
    }

    /**
     * LIKE 검색용 패턴. 검색어 안의 %, _ 는 "아무 글자"가 아니라 글자 그대로 찾아야 하므로 이스케이프한다
     * (이스케이프 문자는 '!', 쿼리의 ESCAPE '!'와 같다). 앞뒤에 %를 붙여 "포함" 검색으로 만든다.
     */
    static String likePattern(String q) {
        if (q == null || q.isBlank()) {
            return null;
        }
        String trimmed = q.trim();
        if (trimmed.length() > MAX_QUERY_LENGTH) {
            throw new IllegalArgumentException("검색어가 너무 깁니다.");
        }
        String escaped = trimmed.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }
}
