package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TableEntryResponse;
import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.dto.TierGroupResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.LabeledEnum;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Recommend;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 서열표 화면: 기준 난이도로 묶고, 로그인한 사용자 본인의 기록을 채보별로 연결한다 (D8).
 *
 * 왜 서비스(Java)에서 묶는가: 한 표는 수백 건(시드 669건) 규모라 전부 읽어도 가볍고,
 * 필터(파트/추천/속성)와 "미정" 묶음 처리, 칩 개수 계산을 SQL로 쓰면 오히려 읽기 어렵다.
 * 대신 쿼리는 2번으로 고정한다(항목 fetch join 1번 + 본인 최고 기록 group by 1번).
 * 레이팅 집계처럼 정렬·상위 N 추출이 필요한 계산은 이후 MyBatis로 한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DifficultyTableViewService {

    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 20;

    private final DifficultyTableRepository difficultyTableRepository;
    private final DifficultyTableEntryRepository entryRepository;
    private final OptionRecordRepository optionRecordRepository;

    /**
     * @param part      null이면 전체
     * @param recommend 상/중/하 (null이면 전체)
     * @param pattern   단일/복합/이중/삼중/레이팅 제외 (null이면 전체)
     * @param mine      true일 때만 본인 기록을 연결한다
     * @param page      묶음(기준 난이도) 단위 페이지. 묶음 하나는 쪼개지 않는다
     */
    public PageResponse<TierGroupResponse> entries(Long userId, Long tableId, InstrumentPart part, String recommend,
                                                   String pattern, boolean mine, int page, int size) {
        DifficultyTable table = difficultyTableRepository.findById(tableId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        Recommend recommendFilter = parseLabel(Recommend.class, recommend);
        PatternType patternFilter = parseLabel(PatternType.class, pattern);

        List<DifficultyTableEntry> entries = entryRepository.findAllForView(tableId).stream()
                .filter(e -> part == null || e.getSongDifficulty().getInstrumentPart() == part)
                .filter(e -> recommendFilter == null || e.getRecommend() == recommendFilter)
                .filter(e -> patternFilter == null || e.getPatternType() == patternFilter)
                .toList();

        Map<Long, RecordBest> bests = new HashMap<>();
        if (mine) {
            // userId는 토큰에서 온 값이다. 요청 파라미터로 다른 사용자를 지정할 수 없다.
            optionRecordRepository.findBestByTable(userId, table.getNoteOption(), tableId)
                    .forEach(b -> bests.put(b.songDifficultyId(), b));
        }

        // 기준 난이도별로 묶는다. 키가 null(미정)인 묶음은 맨 뒤로 보낸다.
        Map<BigDecimal, List<DifficultyTableEntry>> byTier = new TreeMap<>(
                Comparator.nullsLast(Comparator.<BigDecimal>naturalOrder().reversed()));
        for (DifficultyTableEntry e : entries) {
            byTier.computeIfAbsent(e.getTierLabel(), k -> new java.util.ArrayList<>()).add(e);
        }
        List<TierGroupResponse> groups = byTier.entrySet().stream()
                .map(g -> toGroup(g.getKey(), g.getValue(), bests))
                .toList();

        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        int from = Math.min(pageIndex * pageSize, groups.size());
        int to = Math.min(from + pageSize, groups.size());
        int totalPages = (groups.size() + pageSize - 1) / pageSize;
        return new PageResponse<>(groups.subList(from, to), pageIndex, pageSize, groups.size(), totalPages);
    }

    private static TierGroupResponse toGroup(BigDecimal tier, List<DifficultyTableEntry> list,
                                             Map<Long, RecordBest> bests) {
        // 묶음 안 정렬: 레벨 높은 순, 같으면 곡명, 그래도 같으면 id (순서가 매번 같도록)
        List<DifficultyTableEntry> sorted = list.stream()
                .sorted(Comparator.<DifficultyTableEntry, BigDecimal>comparing(e -> e.getSongDifficulty().getLevel()).reversed()
                        .thenComparing(e -> e.getSongDifficulty().getSong().getTitle())
                        .thenComparing(DifficultyTableEntry::getId))
                .toList();

        int exc = 0, fc = 0, ss = 0, s = 0, recorded = 0;
        BigDecimal sum = BigDecimal.ZERO;
        List<TableEntryResponse> rows = new java.util.ArrayList<>();
        for (DifficultyTableEntry e : sorted) {
            RecordBest best = bests.get(e.getSongDifficulty().getId());
            MyRecord mineRecord = null;
            if (best != null) {
                AchievementStage stage = AchievementStage.of(best.bestRate(), best.fullCombo());
                mineRecord = new MyRecord(best.bestRate(), best.fullCombo(), stage);
                recorded++;
                sum = sum.add(best.bestRate());
                // 단계는 가장 높은 하나만 센다. 80 미만(stage null)은 어느 칩에도 넣지 않는다.
                if (stage != null) {
                    switch (stage) {
                        case EXC -> exc++;
                        case FC -> fc++;
                        case SS -> ss++;
                        case S -> s++;
                    }
                }
            }
            rows.add(TableEntryResponse.of(e, mineRecord));
        }
        int total = sorted.size();
        BigDecimal avgRecorded = recorded == 0 ? null : sum.divide(BigDecimal.valueOf(recorded), 2, RoundingMode.HALF_UP);
        BigDecimal avgWithZero = total == 0 ? BigDecimal.ZERO.setScale(2)
                : sum.divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        return new TierGroupResponse(tier, total, recorded, exc, fc, ss, s, avgRecorded, avgWithZero, rows);
    }

    private static <E extends Enum<E> & LabeledEnum> E parseLabel(Class<E> type, String label) {
        if (label == null || label.isBlank()) {
            return null;
        }
        try {
            return LabeledEnum.fromLabel(type, label.strip());
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }
}
