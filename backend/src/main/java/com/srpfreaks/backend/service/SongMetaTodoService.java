package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SongMetaTodoResponse;
import com.srpfreaks.backend.dto.SongMetaTodoResponse.Row;
import com.srpfreaks.backend.dto.SongMetaTodoResponse.Summary;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.mapper.SongMetaTodoMapper;
import com.srpfreaks.backend.mapper.SongMetaTodoRow;
import com.srpfreaks.backend.mapper.SongMetaTodoSummaryRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * 곡 정보 정리(D91): 아티스트나 검색 키워드(song_titles)가 비어 있는 곡만 모아 보는 읽기 전용 목록.
 * 저장은 이 서비스가 하지 않는다 - 화면이 기존 곡 수정 API(PUT /songs/{id}, D22)를 그대로 부르고, 감사 로그도 거기서 남는다.
 * 권한은 컨트롤러 경계(@PreAuthorize + /api/v1/admin/** 주소 규칙)에서 막는다.
 *
 * 필터·정렬 값은 화이트리스트로 검사한다(허용 밖 값은 400). 값은 SQL에 이어 붙이지 않고 #{}로 바인딩된다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SongMetaTodoService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 100;
    /** 곡명 검색어 최대 길이. 곡명 최대(255자)보다 짧게 둬서 터무니없이 긴 글자로 DB를 부르지 않게 한다. */
    public static final int MAX_QUERY_LENGTH = 100;

    /** 화면 칩과 1:1: ANY = 전체 미등록, ARTIST = 아티스트 없음, KEYWORD = 검색 키워드 없음, BOTH = 둘 다. */
    static final Set<String> FILTERS = Set.of("ANY", "ARTIST", "KEYWORD", "BOTH");
    static final Set<String> SORTS = Set.of("title", "level");

    private final SongMetaTodoMapper mapper;

    public SongMetaTodoResponse list(String filter, String q, String sort, int page, int size) {
        String safeFilter = filter == null || filter.isBlank() ? "ANY" : filter.trim().toUpperCase(java.util.Locale.ROOT);
        if (!FILTERS.contains(safeFilter)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        String safeSort = sort == null || sort.isBlank() ? "title" : sort.trim();
        if (!SORTS.contains(safeSort)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        String pattern = likePattern(q);
        // 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(다른 목록 API와 같다)
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);

        long total = mapper.count(safeFilter, pattern);
        List<Row> content = total == 0 ? List.of()
                : mapper.findPage(safeFilter, pattern, safeSort, safeSize, (long) safePage * safeSize).stream()
                        .map(SongMetaTodoService::toRow)
                        .toList();
        int totalPages = (int) ((total + safeSize - 1) / safeSize);
        return new SongMetaTodoResponse(summary(), new PageResponse<>(content, safePage, safeSize, total, totalPages));
    }

    private Summary summary() {
        SongMetaTodoSummaryRow row = mapper.summary();
        return new Summary(row.totalSongs(), row.noArtist(), row.noKeyword(), row.bothMissing(),
                row.noArtist() + row.noKeyword() - row.bothMissing());
    }

    private static Row toRow(SongMetaTodoRow r) {
        return new Row(r.songId(), r.title(), r.artist(), r.titleCount(),
                r.topPart() == null ? null : InstrumentPart.valueOf(r.topPart()),
                r.topDifficulty() == null ? null : DifficultyType.valueOf(r.topDifficulty()),
                r.topLevel());
    }

    /** LIKE 패턴(이스케이프 문자 '!', 쿼리의 ESCAPE '!'와 같다). 빈 검색어는 null(조건 없음), 너무 긴 검색어는 400. */
    static String likePattern(String q) {
        if (q == null || q.isBlank()) {
            return null;
        }
        String trimmed = q.trim();
        if (trimmed.length() > MAX_QUERY_LENGTH) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        return "%" + trimmed.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }
}
