package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.ChartSort;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RateBucketResponse;
import com.srpfreaks.backend.dto.RateFolderListResponse;
import com.srpfreaks.backend.dto.RateFolderResponse;
import com.srpfreaks.backend.dto.TableEntryResponse;
import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.RateBucket;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 마이페이지 통계: 폴더(레벨 폴더 / 서열표 난이도) 안에서 내 기록을 달성률 구간으로 나눠 센다.
 *
 * 왜 서비스(Java)에서 묶는가: 곡 목록(SongChartListService)·서열표(DifficultyTableViewService)와 같은 판단이다.
 * 채보가 수백 개 규모라 전부 읽어도 가볍고, 구간 나누기와 MAX/FC 따로 세기를 SQL로 쓰면 오히려 읽기 어렵다.
 * 쿼리는 채보 1번 + 내 최고 기록 1번으로 고정이다. userId는 토큰에서만 온다(다른 사용자의 기록은 섞이지 않는다).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RateFolderService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;

    private static final BigDecimal MAX_RATE = new BigDecimal("100.00");

    private final SongDifficultyRepository songDifficultyRepository;
    private final OptionRecordRepository optionRecordRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final DifficultyTableEntryRepository entryRepository;

    /**
     * 레벨 폴더(0.5 단위) 목록. 곡 목록과 같은 대상(삭제되지 않은 모든 채보)이고 폴더 경계도 같다.
     * 서열표에 없거나 기준 난이도가 미정인 채보도 포함한다.
     */
    public RateFolderListResponse levelFolders(Long userId) {
        List<SongDifficulty> charts = songDifficultyRepository.findAllActiveWithSong();
        Map<Long, RecordBest> bests = new HashMap<>();
        optionRecordRepository.findBestByUser(userId, SongChartListService.RECORD_OPTION)
                .forEach(b -> bests.put(b.songDifficultyId(), b));

        // 레벨이 높은 폴더가 위
        Map<BigDecimal, List<RecordBest>> byFolder = new TreeMap<>(Comparator.<BigDecimal>naturalOrder().reversed());
        for (SongDifficulty d : charts) {
            // 기록 없는 채보는 null로 넣는다(미플레이 구간으로 센다)
            byFolder.computeIfAbsent(SongChartListService.folderLow(d.getLevel()), k -> new ArrayList<>())
                    .add(bests.get(d.getId()));
        }
        List<RateFolderResponse> folders = byFolder.entrySet().stream()
                .map(e -> toFolder(e.getKey(), e.getValue()))
                .toList();
        return new RateFolderListResponse(folders);
    }

    /**
     * 서열표 난이도(기준 난이도) 목록. 서열표에 올라 있고 기준 난이도가 있는 채보만 센다(미정은 서열표 화면과 같이 뺀다).
     * 기록은 서열표 소속 채보에 대한 본인 최고 기록이고, 노트 옵션은 서열표의 옵션을 따른다.
     * 표가 없으면 404다.
     */
    public RateFolderListResponse tierFolders(Long userId, Long tableId) {
        DifficultyTable table = difficultyTableRepository.findById(tableId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        List<DifficultyTableEntry> entries = entryRepository.findAllForView(tableId).stream()
                .filter(e -> e.getTierLabel() != null)
                .toList();
        Map<Long, RecordBest> bests = new HashMap<>();
        optionRecordRepository.findBestByTable(userId, table.getNoteOption(), tableId)
                .forEach(b -> bests.put(b.songDifficultyId(), b));

        // 기준 난이도가 높은 묶음이 위 (서열표 화면과 같은 순서)
        Map<BigDecimal, List<RecordBest>> byTier = new TreeMap<>(Comparator.<BigDecimal>naturalOrder().reversed());
        for (DifficultyTableEntry e : entries) {
            byTier.computeIfAbsent(e.getTierLabel(), k -> new ArrayList<>())
                    .add(bests.get(e.getSongDifficulty().getId()));
        }
        List<RateFolderResponse> folders = byTier.entrySet().stream()
                .map(e -> toFolder(e.getKey(), e.getValue()))
                .toList();
        return new RateFolderListResponse(folders);
    }

    /**
     * 서열표 난이도 폴더 안의 채보 목록(페이지). 기준 난이도 하나(tier)에 속한 채보 중 내 대표 기록이 rateBucket에 속하는 것만 보인다.
     * 서열표 화면의 줄(TableEntryResponse)과 같은 모양이라 화면이 같은 줄 컴포넌트를 쓴다.
     *
     * @param tier       기준 난이도(예: 6.0). 이 값의 묶음이 없으면 빈 목록
     * @param rateBucket null이면 구간 필터 없음(UNPLAYED는 기록 없는 채보)
     * @param part       null이면 전체
     * @param sort       null이면 LEVEL(레벨 높은 순 -> 곡명 -> id). RATE_*는 기록 없는 채보를 항상 맨 뒤에 둔다
     */
    public PageResponse<TableEntryResponse> tierCharts(Long userId, Long tableId, BigDecimal tier, RateBucket rateBucket,
                                                       InstrumentPart part, ChartSort sort, int page, int size) {
        DifficultyTable table = difficultyTableRepository.findById(tableId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        Map<Long, RecordBest> bests = new HashMap<>();
        optionRecordRepository.findBestByTable(userId, table.getNoteOption(), tableId)
                .forEach(b -> bests.put(b.songDifficultyId(), b));

        Comparator<DifficultyTableEntry> byLevel = Comparator
                .<DifficultyTableEntry, BigDecimal>comparing(e -> e.getSongDifficulty().getLevel()).reversed()
                .thenComparing(e -> e.getSongDifficulty().getSong().getTitle())
                .thenComparing(DifficultyTableEntry::getId);
        Comparator<DifficultyTableEntry> order = byLevel;
        if (sort == ChartSort.RATE_DESC || sort == ChartSort.RATE_ASC) {
            Comparator<BigDecimal> rateOrder = sort == ChartSort.RATE_DESC
                    ? Comparator.nullsLast(Comparator.<BigDecimal>reverseOrder())
                    : Comparator.nullsLast(Comparator.<BigDecimal>naturalOrder());
            order = Comparator.<DifficultyTableEntry, BigDecimal>comparing(e -> rateOf(bests, e), rateOrder).thenComparing(byLevel);
        }

        List<DifficultyTableEntry> filtered = entryRepository.findAllForView(tableId).stream()
                .filter(e -> e.getTierLabel() != null && e.getTierLabel().compareTo(tier) == 0)
                .filter(e -> part == null || e.getSongDifficulty().getInstrumentPart() == part)
                .filter(e -> rateBucket == null || RateBucket.of(rateOf(bests, e)) == rateBucket)
                .sorted(order)
                .toList();

        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        int from = (int) Math.min((long) pageIndex * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());
        int totalPages = (filtered.size() + pageSize - 1) / pageSize;
        List<TableEntryResponse> rows = filtered.subList(from, to).stream()
                .map(e -> TableEntryResponse.of(e, myRecord(bests.get(e.getSongDifficulty().getId()))))
                .toList();
        return new PageResponse<>(rows, pageIndex, pageSize, filtered.size(), totalPages);
    }

    private static BigDecimal rateOf(Map<Long, RecordBest> bests, DifficultyTableEntry e) {
        RecordBest best = bests.get(e.getSongDifficulty().getId());
        return best == null ? null : best.bestRate();
    }

    private static MyRecord myRecord(RecordBest best) {
        return best == null ? null
                : new MyRecord(best.bestRate(), best.fullCombo(), AchievementStage.of(best.bestRate(), best.fullCombo()));
    }

    /**
     * 채보별 대표 기록(없으면 null)을 받아 구간별 개수를 센다.
     * 구간은 달성률만 보고, MAX(100.00)와 FC(풀콤보이면서 100 미만)는 그 구간 안에서 따로 센다.
     */
    static RateFolderResponse toFolder(BigDecimal key, List<RecordBest> bestOfCharts) {
        // 구간마다 [채보 수, MAX 수, FC 수]. EnumMap이라 꺼낼 때 선언 순서(표시 순서)가 유지된다
        Map<RateBucket, int[]> counters = new EnumMap<>(RateBucket.class);
        for (RateBucket bucket : RateBucket.values()) {
            counters.put(bucket, new int[3]);
        }
        int recorded = 0;
        for (RecordBest best : bestOfCharts) {
            BigDecimal rate = best == null ? null : best.bestRate();
            int[] counter = counters.get(RateBucket.of(rate));
            counter[0]++;
            if (best == null) {
                continue;
            }
            recorded++;
            if (rate.compareTo(MAX_RATE) >= 0) {
                counter[1]++;
            } else if (best.fullCombo()) {
                // 100.00은 FC 표시가 켜져 있어도 MAX로만 센다(둘 다 세면 같은 채보가 두 번 보인다)
                counter[2]++;
            }
        }
        List<RateBucketResponse> buckets = counters.entrySet().stream()
                .map(e -> new RateBucketResponse(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .toList();
        return new RateFolderResponse(key, bestOfCharts.size(), recorded, buckets);
    }
}
