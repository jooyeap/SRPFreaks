package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SetlistItemResponse;
import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SetlistEventType;
import com.srpfreaks.backend.entity.SetlistItem;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.RecordLatestUpdate;
import com.srpfreaks.backend.repository.SetlistItemRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 세트리스트 (D36): 오늘 칠 채보를 미리 담아 두는 사용자별 임시 목록.
 * 모든 조회·삭제는 userId(토큰에서만 옴)로 좁혀서, 남의 줄은 존재 여부도 알 수 없다(없는 줄과 똑같이 404).
 *
 * 완료 여부는 저장하지 않고 계산한다: 담은 시각 이후에 그 채보 기록을 저장·수정했으면 완료.
 * 기록 저장 코드(직접 입력, 사진 입력, 최근 플레이 가져오기)를 건드리지 않아도 모든 경로가 같은 규칙으로 체크된다.
 * 목록 한 번에 쿼리는 줄(+채보+곡) 1번, 내 최고 기록 1번, 최근 수정 시각 1번, 서열표 난이도 1번 + 표 찾기 1번으로 고정이다(N+1 없음).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SetlistService {

    public static final int MAX_PAGE_SIZE = SetlistItem.MAX_ITEMS;

    /** 세트리스트가 보여 주는 기록과 서열표의 노트 옵션. 기록은 SRN+ 하나만 받는다(D25). */
    static final NoteOption RECORD_OPTION = NoteOption.SUPER_RANDOM_PLUS;

    private final SetlistItemRepository setlistItemRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final OptionRecordRepository optionRecordRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final DifficultyTableEntryRepository difficultyTableEntryRepository;
    private final UserRepository userRepository;
    /** 담기/빼기 이력(D52). 실패해도 담기/빼기는 성공한다. */
    private final SetlistEventRecorder eventRecorder;

    /** 담은 순서대로. 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(목록 API 공통 방식). 최대 30줄이라 한 페이지에 다 담긴다. */
    @Transactional(readOnly = true)
    public PageResponse<SetlistItemResponse> list(Long userId, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<SetlistItem> items = setlistItemRepository.findActiveByUserId(userId, PageRequest.of(Math.max(page, 0), pageSize));
        // 채보별 조회(최고 기록·완료 시각·난이도)를 한 번씩만 하려고 줄 전체를 한꺼번에 응답으로 바꾼다(PageResponse.of는 줄마다 변환한다)
        return new PageResponse<>(toResponses(userId, items.getContent()), items.getNumber(), items.getSize(),
                items.getTotalElements(), items.getTotalPages());
    }

    public SetlistItemResponse add(Long userId, Long songDifficultyId) {
        SongDifficulty chart = songDifficultyRepository.findByIdAndDeletedFalse(songDifficultyId)
                .filter(d -> !d.getSong().isDeleted())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        if (setlistItemRepository.existsByUserIdAndSongDifficultyId(userId, songDifficultyId)) {
            throw new ApiException(ErrorCode.CONFLICT);
        }
        if (setlistItemRepository.countActiveByUserId(userId) >= SetlistItem.MAX_ITEMS) {
            throw new ApiException(ErrorCode.SETLIST_FULL);
        }
        SetlistItem saved = setlistItemRepository.save(SetlistItem.create(userRepository.getReferenceById(userId), chart));
        eventRecorder.record(userId, songDifficultyId, SetlistEventType.ADD);
        return toResponses(userId, List.of(saved)).get(0);
    }

    public void remove(Long userId, Long setlistItemId) {
        SetlistItem item = setlistItemRepository.findByIdAndUserId(setlistItemId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        setlistItemRepository.delete(item);
        // 직접 뺀 것만 기록한다. clearDone(완료한 곡 비우기)은 포기가 아니라 정리라서 남기지 않는다.
        eventRecorder.record(userId, item.getSongDifficulty().getId(), SetlistEventType.REMOVE);
    }

    /** 완료한 줄을 한꺼번에 비운다(다음 방문 준비). 지운 줄 수를 돌려준다. 삭제된 채보에 남은 줄도 함께 정리한다. */
    public int clearDone(Long userId) {
        List<SetlistItem> all = setlistItemRepository.findAllByUserId(userId);
        Map<Long, Instant> latest = latestUpdates(userId, all);
        List<SetlistItem> done = all.stream()
                .filter(i -> i.isDoneBy(latest.get(i.getSongDifficulty().getId())) || i.getSongDifficulty().isDeleted())
                .toList();
        setlistItemRepository.deleteAll(done);
        return done.size();
    }

    private List<SetlistItemResponse> toResponses(Long userId, List<SetlistItem> items) {
        if (items.isEmpty()) {
            return List.of();
        }
        List<Long> chartIds = items.stream().map(i -> i.getSongDifficulty().getId()).toList();
        Map<Long, Instant> latest = latestUpdates(userId, items);
        Map<Long, RecordBest> bests = new HashMap<>();
        // 최고 기록은 사용자의 전체 채보 대상이지만 쿼리 1번이고 곡 목록 화면과 같은 방식이라 재사용한다
        optionRecordRepository.findBestByUser(userId, RECORD_OPTION).forEach(b -> bests.put(b.songDifficultyId(), b));
        Map<Long, DifficultyTableEntry> entries = entriesOf(chartIds);
        return items.stream().map(i -> {
            Long chartId = i.getSongDifficulty().getId();
            RecordBest best = bests.get(chartId);
            MyRecord mine = best == null ? null
                    : new MyRecord(best.bestRate(), best.fullCombo(), AchievementStage.of(best.bestRate(), best.fullCombo()));
            DifficultyTableEntry entry = entries.get(chartId);
            BigDecimal tier = entry == null ? null : entry.getTierLabel();
            // 속성은 서열표에 적힌 글자 그대로(단일/복합/이중/삼중/레이팅 제외) 내려 준다. 화면이 현재 언어로 바꿔 보인다.
            String pattern = entry == null || entry.getPatternType() == null ? null : entry.getPatternType().getLabel();
            return SetlistItemResponse.of(i, tier, pattern, mine, i.isDoneBy(latest.get(chartId)));
        }).toList();
    }

    private Map<Long, Instant> latestUpdates(Long userId, List<SetlistItem> items) {
        List<Long> chartIds = items.stream().map(i -> i.getSongDifficulty().getId()).toList();
        Map<Long, Instant> latest = new HashMap<>();
        if (chartIds.isEmpty()) {
            return latest;
        }
        for (RecordLatestUpdate u : optionRecordRepository.findLatestUpdates(userId, RECORD_OPTION, chartIds)) {
            latest.put(u.songDifficultyId(), u.latestUpdate());
        }
        return latest;
    }

    /** SRN+ 활성 서열표에서 채보별 서열표 항목(기준 난이도 T와 속성을 함께 쓴다). 표가 없거나 서열표에 없는 채보는 맵에 없다. */
    private Map<Long, DifficultyTableEntry> entriesOf(List<Long> chartIds) {
        Map<Long, DifficultyTableEntry> entries = new HashMap<>();
        Optional<DifficultyTable> table = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(RECORD_OPTION, TableStatus.ACTIVE);
        if (table.isEmpty()) {
            return entries;
        }
        for (DifficultyTableEntry e : difficultyTableEntryRepository
                .findByDifficultyTableIdAndSongDifficultyIdIn(table.get().getId(), chartIds)) {
            entries.put(e.getSongDifficulty().getId(), e);
        }
        return entries;
    }
}
