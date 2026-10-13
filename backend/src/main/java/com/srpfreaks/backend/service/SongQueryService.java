package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SongDetailResponse;
import com.srpfreaks.backend.dto.SongSummaryResponse;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** 곡 조회(검색, 상세). 로그인한 모든 사용자가 쓴다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SongQueryService {

    public static final int MAX_PAGE_SIZE = 50;
    public static final int DEFAULT_PAGE_SIZE = 20;
    static final int MAX_KEYWORD_LENGTH = 100;

    // 정렬은 화이트리스트로만 받는다. 요청 값을 그대로 컬럼명으로 쓰면 임의 컬럼 정렬/오류 노출이 가능해진다.
    private static final Map<String, Sort> SORTS = Map.of(
            "title", Sort.by(Sort.Direction.ASC, "title").and(Sort.by("id")),
            "recent", Sort.by(Sort.Direction.DESC, "id"));

    private final SongRepository songRepository;
    private final SongTitleRepository songTitleRepository;
    private final SongDifficultyRepository songDifficultyRepository;

    public PageResponse<SongSummaryResponse> search(String keyword, int page, int size, String sort) {
        Sort order = SORTS.get(sort == null || sort.isBlank() ? "title" : sort);
        if (order == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        String trimmed = keyword == null ? "" : keyword.strip();
        if (trimmed.length() > MAX_KEYWORD_LENGTH) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        // 페이지 크기 상한: 한 번에 큰 목록을 요청해 서버를 느리게 만드는 것을 막는다
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE), order);

        Page<Song> result = trimmed.isEmpty()
                ? songRepository.findByDeletedFalse(pageable)
                : songRepository.search(likePattern(trimmed), likePattern(SongTitle.normalize(trimmed)), pageable);
        return PageResponse.of(result, SongSummaryResponse::from);
    }

    public SongDetailResponse detail(Long songId) {
        Song song = songRepository.findByIdAndDeletedFalse(songId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        return detailOf(song);
    }

    /** 곡 + 표기 + 채보를 묶는다. 관리 서비스도 응답을 만들 때 쓴다. 쿼리는 곡당 3번으로 고정이다(N+1 없음). */
    SongDetailResponse detailOf(Song song) {
        List<SongTitle> titles = songTitleRepository.findBySongId(song.getId());
        List<SongDifficulty> difficulties = songDifficultyRepository.findBySongIdAndDeletedFalse(song.getId()).stream()
                .sorted(Comparator.comparing(SongDifficulty::getInstrumentPart)
                        .thenComparing(SongDifficulty::getDifficultyType))
                .toList();
        return SongDetailResponse.of(song, titles, difficulties);
    }

    /** LIKE 패턴: 키워드의 %, _, !는 문자 그대로 찾도록 이스케이프한다('!'가 이스케이프 문자). */
    public static String likePattern(String keyword) {
        String escaped = keyword.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }
}
