package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SnapshotCompareResponse;
import com.srpfreaks.backend.dto.SnapshotCompareResponse.Change;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SkillSnapshot;
import com.srpfreaks.backend.entity.SkillSnapshotEntry;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.SkillSnapshotEntryRepository;
import com.srpfreaks.backend.repository.SkillSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 레이팅 스냅샷 비교 (D32 확장). 두 시점의 레이팅 목록을 채보 단위로 견줘 오른 곡·새로 들어온 곡·밀려난 곡을 돌려준다.
 *  - 스냅샷끼리: 고른 스냅샷 vs 바로 이전 스냅샷 (기록 테이블이 아니라 스냅샷에 저장해 둔 상세를 쓰므로 기록 수정·삭제와 무관하게 정확하다)
 *  - 스냅샷 vs 지금: 가장 최근 스냅샷 vs 계산한 현재 레이팅 (마이페이지 요약 한 줄에 쓴다)
 * 대상은 토큰에서 나온 userId뿐이고, 남의 스냅샷 id를 주면 없는 것과 같은 404다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SkillSnapshotCompareService {

    private final SkillSnapshotRepository snapshotRepository;
    private final SkillSnapshotEntryRepository entryRepository;
    private final SkillService skillService;

    /** 비교에 쓰는 한 줄(저장된 상세와 계산한 현재 레이팅을 같은 모양으로 맞춘 것). */
    record Row(Long chartId, Long songId, String title, InstrumentPart part, DifficultyType difficulty,
               String group, BigDecimal rate, BigDecimal score) {
    }

    public SnapshotCompareResponse compareWithPrevious(Long userId, Long snapshotId) {
        SkillSnapshot snapshot = snapshotRepository.findById(snapshotId)
                .filter(s -> s.getUser().getId().equals(userId))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        SkillSnapshot previous = snapshotRepository
                .findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(
                        userId, snapshot.getNoteOption(), snapshot.getSnapshotDate()).orElse(null);
        if (previous == null) {
            return SnapshotCompareResponse.unavailable("NO_PREVIOUS");
        }
        List<Row> before = rowsOf(previous);
        List<Row> after = rowsOf(snapshot);
        if (before.isEmpty() || after.isEmpty()) {
            return SnapshotCompareResponse.unavailable("NO_DETAIL"); // 상세 저장 기능 이전에 만든 스냅샷
        }
        return diff(before, after, previous.getSnapshotDate(), snapshot.getSnapshotDate(),
                previous.getTotalScore(), snapshot.getTotalScore());
    }

    public SnapshotCompareResponse compareLatestWithCurrent(Long userId) {
        NoteOption option = skillService.ratingNoteOption();
        SkillSnapshot latest = snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(userId, option).orElse(null);
        if (latest == null) {
            return SnapshotCompareResponse.unavailable("NO_SNAPSHOT");
        }
        List<Row> before = rowsOf(latest);
        if (before.isEmpty()) {
            return SnapshotCompareResponse.unavailable("NO_DETAIL");
        }
        SkillResponse current = skillService.mySkill(userId);
        List<Row> after = new ArrayList<>();
        current.single().forEach(e -> after.add(rowOf(e, "SINGLE")));
        current.other().forEach(e -> after.add(rowOf(e, "OTHER")));
        return diff(before, after, latest.getSnapshotDate(), null, latest.getTotalScore(), current.totalScore());
    }

    private List<Row> rowsOf(SkillSnapshot snapshot) {
        List<Row> rows = new ArrayList<>();
        for (SkillSnapshotEntry e : entryRepository.findAllWithChart(snapshot.getId())) {
            SongDifficulty d = e.getSongDifficulty();
            rows.add(new Row(d.getId(), d.getSong().getId(), d.getSong().getTitle(), d.getInstrumentPart(),
                    d.getDifficultyType(), e.getListGroup().name(), e.getAchievementRate(), e.getScore()));
        }
        return rows;
    }

    private static Row rowOf(SkillEntryResponse e, String group) {
        return new Row(e.songDifficultyId(), e.songId(), e.title(), e.part(), e.difficulty(), group,
                e.achievementRate(), e.score());
    }

    /** 채보(chartId)를 열쇠로 두 목록을 견준다. 같은 달성률은 어느 쪽에도 담지 않는다. */
    static SnapshotCompareResponse diff(List<Row> before, List<Row> after,
                                        java.time.LocalDate fromDate, java.time.LocalDate toDate,
                                        BigDecimal fromTotal, BigDecimal toTotal) {
        Map<Long, Row> beforeBy = new LinkedHashMap<>();
        before.forEach(r -> beforeBy.put(r.chartId(), r));
        Map<Long, Row> afterBy = new LinkedHashMap<>();
        after.forEach(r -> afterBy.put(r.chartId(), r));

        List<Change> entered = new ArrayList<>();
        List<Change> improved = new ArrayList<>();
        List<Change> declined = new ArrayList<>();
        List<Change> left = new ArrayList<>();
        for (Row a : after) {
            Row b = beforeBy.get(a.chartId());
            if (b == null) {
                entered.add(change(null, a));
            } else {
                int cmp = a.rate().compareTo(b.rate());
                if (cmp > 0) {
                    improved.add(change(b, a));
                } else if (cmp < 0) {
                    declined.add(change(b, a));
                }
            }
        }
        for (Row b : before) {
            if (!afterBy.containsKey(b.chartId())) {
                left.add(change(b, null));
            }
        }
        // 눈에 띄는 순서: 점수가 크게 바뀐 곡이 위로
        entered.sort(Comparator.comparing((Change c) -> c.scoreAfter()).reversed());
        improved.sort(Comparator.comparing((Change c) -> c.scoreAfter().subtract(c.scoreBefore())).reversed());
        declined.sort(Comparator.comparing((Change c) -> c.scoreAfter().subtract(c.scoreBefore())));
        left.sort(Comparator.comparing((Change c) -> c.scoreBefore()).reversed());
        return new SnapshotCompareResponse(true, null, fromDate, toDate, fromTotal, toTotal,
                toTotal.subtract(fromTotal), entered, improved, declined, left);
    }

    private static Change change(Row before, Row after) {
        Row base = after != null ? after : before; // 곡 정보는 존재하는 쪽에서 가져온다
        return new Change(base.chartId(), base.songId(), base.title(), base.part(), base.difficulty(),
                base.group(), before == null ? null : before.rate(), after == null ? null : after.rate(),
                before == null ? null : before.score(), after == null ? null : after.score());
    }
}
