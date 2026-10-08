package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.ChartFolderListResponse;
import com.srpfreaks.backend.dto.ChartFolderResponse;
import com.srpfreaks.backend.dto.ChartRowResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

/**
 * 전체 곡 목록 화면(DESIGN-UI 9장): 레벨 폴더(0.5 단위) 통계, 폴더 안 채보, 검색·필터 결과.
 * 내 기록은 SRN+ 최고 기록만 연결한다(기록은 SRN+ 하나, D25). 곡 목록은 채보 단위다(한 곡의 MAS와 EXT는 각자 폴더에 들어간다).
 *
 * 왜 서비스(Java)에서 묶는가: 채보는 수백 개(시드 669개) 규모라 전부 읽어도 가볍고(서열표 화면과 같은 판단),
 * 폴더 묶기·통계·필터를 SQL로 쓰면 오히려 읽기 어렵다. 쿼리는 채보(곡 fetch join) 1번 + 내 최고 기록 1번 + (검색할 때만) 곡 id 1번이다.
 * userId는 토큰에서만 온다. 다른 사용자의 기록은 섞이지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SongChartListService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;
    static final int MAX_VERSION_LENGTH = 30;   // songs.added_version 컬럼 길이

    /** 곡 목록이 보여 주는 기록의 노트 옵션. 기록은 SRN+ 하나만 받는다(D25). */
    static final NoteOption RECORD_OPTION = NoteOption.SUPER_RANDOM_PLUS;

    private static final BigDecimal FOLDER_STEP = new BigDecimal("0.50");
    private static final BigDecimal FOLDER_SPAN = new BigDecimal("0.49");   // 9.50 ~ 9.99처럼 폴더 끝은 시작 + 0.49

    private final SongDifficultyRepository songDifficultyRepository;
    private final OptionRecordRepository optionRecordRepository;
    private final SongRepository songRepository;

    /** 레벨 폴더 목록. 필터 없이 전체 채보를 대상으로 한다(검색·필터를 쓰면 화면이 폴더 대신 결과 목록으로 바뀐다). */
    public ChartFolderListResponse folders(Long userId) {
        List<SongDifficulty> charts = songDifficultyRepository.findAllActiveWithSong();
        Map<Long, RecordBest> bests = bestsOf(userId);

        // 레벨이 높은 폴더가 위
        Map<BigDecimal, List<SongDifficulty>> byFolder = new TreeMap<>(Comparator.<BigDecimal>naturalOrder().reversed());
        for (SongDifficulty d : charts) {
            byFolder.computeIfAbsent(folderLow(d.getLevel()), k -> new ArrayList<>()).add(d);
        }
        List<ChartFolderResponse> folders = byFolder.entrySet().stream()
                .map(e -> toFolder(e.getKey(), e.getValue(), bests))
                .toList();

        Set<Long> songIds = new HashSet<>();
        charts.forEach(d -> songIds.add(d.getSong().getId()));
        List<String> versions = charts.stream()
                .map(d -> d.getSong().getAddedVersion())
                .filter(v -> v != null && !v.isBlank())
                .distinct()
                .sorted()
                .toList();
        return new ChartFolderListResponse(songIds.size(), charts.size(), versions, folders);
    }

    /**
     * 채보 목록(페이지). 폴더 안 펼치기(folder 지정)와 검색·필터 결과(나머지)가 같은 API다.
     * 정렬은 레벨 높은 순 -> 곡명 -> id (순서가 요청마다 바뀌지 않게 고정).
     *
     * @param q            곡명·아티스트·표기/별칭 검색어(없으면 전체)
     * @param folder       폴더 시작 레벨(예: 9.50). 0.5 단위가 아니면 400
     * @param difficulties 비어 있으면 전체
     * @param version      null/빈 값이면 전체
     */
    public PageResponse<ChartRowResponse> charts(Long userId, String q, BigDecimal folder, InstrumentPart part,
                                                 Collection<DifficultyType> difficulties, String version,
                                                 int page, int size) {
        String keyword = q == null ? "" : q.strip();
        if (keyword.length() > SongQueryService.MAX_KEYWORD_LENGTH) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        String versionFilter = version == null || version.isBlank() ? null : version.strip();
        if (versionFilter != null && versionFilter.length() > MAX_VERSION_LENGTH) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        if (folder != null && (folder.signum() < 0 || folder.remainder(FOLDER_STEP).signum() != 0)) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }

        Set<Long> matchingSongIds = keyword.isEmpty() ? null : new HashSet<>(songRepository.searchIds(
                SongQueryService.likePattern(keyword), SongQueryService.likePattern(SongTitle.normalize(keyword))));

        List<SongDifficulty> filtered = songDifficultyRepository.findAllActiveWithSong().stream()
                .filter(d -> matchingSongIds == null || matchingSongIds.contains(d.getSong().getId()))
                .filter(d -> folder == null || folderLow(d.getLevel()).compareTo(folder) == 0)
                .filter(d -> part == null || d.getInstrumentPart() == part)
                .filter(d -> difficulties == null || difficulties.isEmpty() || difficulties.contains(d.getDifficultyType()))
                .filter(d -> versionFilter == null || versionFilter.equals(d.getSong().getAddedVersion()))
                .sorted(Comparator.<SongDifficulty, BigDecimal>comparing(SongDifficulty::getLevel).reversed()
                        .thenComparing(d -> d.getSong().getTitle())
                        .thenComparing(SongDifficulty::getId))
                .toList();

        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        int from = (int) Math.min((long) pageIndex * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());
        int totalPages = (filtered.size() + pageSize - 1) / pageSize;

        // 내 기록은 이번 페이지의 채보에만 필요하지만 한 번의 group by 쿼리로 모두 가져온다(채보마다 쿼리하면 N+1)
        Map<Long, RecordBest> bests = bestsOf(userId);
        List<ChartRowResponse> rows = filtered.subList(from, to).stream()
                .map(d -> ChartRowResponse.of(d, myRecord(bests.get(d.getId()))))
                .toList();
        return new PageResponse<>(rows, pageIndex, pageSize, filtered.size(), totalPages);
    }

    /** 레벨이 속한 0.5 단위 폴더의 시작값. 9.49 -> 9.00, 9.50 -> 9.50, 9.99 -> 9.50. */
    static BigDecimal folderLow(BigDecimal level) {
        return level.divide(FOLDER_STEP, 0, RoundingMode.DOWN).multiply(FOLDER_STEP).setScale(2, RoundingMode.UNNECESSARY);
    }

    private Map<Long, RecordBest> bestsOf(Long userId) {
        Map<Long, RecordBest> bests = new HashMap<>();
        optionRecordRepository.findBestByUser(userId, RECORD_OPTION).forEach(b -> bests.put(b.songDifficultyId(), b));
        return bests;
    }

    private static MyRecord myRecord(RecordBest best) {
        return best == null ? null
                : new MyRecord(best.bestRate(), best.fullCombo(), AchievementStage.of(best.bestRate(), best.fullCombo()));
    }

    private static ChartFolderResponse toFolder(BigDecimal lo, List<SongDifficulty> list, Map<Long, RecordBest> bests) {
        int exc = 0, fc = 0, ss = 0, s = 0, belowS = 0, recorded = 0;
        BigDecimal sum = BigDecimal.ZERO;
        for (SongDifficulty d : list) {
            RecordBest best = bests.get(d.getId());
            if (best == null) {
                continue;   // 기록 없는 채보는 어느 칩에도 세지 않는다 (D24)
            }
            AchievementStage stage = AchievementStage.of(best.bestRate(), best.fullCombo());
            recorded++;
            sum = sum.add(best.bestRate());
            // 단계는 가장 높은 하나만 센다. S에 못 미친 A/B/C는 "S 미만" 하나로 합친다 (서열표 묶음과 같은 규칙)
            switch (stage) {
                case EXC -> exc++;
                case FC -> fc++;
                case SS -> ss++;
                case S -> s++;
                case A, B, C -> belowS++;
            }
        }
        int total = list.size();
        BigDecimal avgRecorded = recorded == 0 ? null : sum.divide(BigDecimal.valueOf(recorded), 2, RoundingMode.HALF_UP);
        BigDecimal avgWithZero = sum.divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        return new ChartFolderResponse(lo, lo.add(FOLDER_SPAN), total, recorded, exc, fc, ss, s, belowS, avgRecorded, avgWithZero);
    }
}
