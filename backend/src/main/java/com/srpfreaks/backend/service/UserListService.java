package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.dto.UserListAddItemResponse;
import com.srpfreaks.backend.dto.UserListDetailResponse;
import com.srpfreaks.backend.dto.UserListItemResponse;
import com.srpfreaks.backend.dto.UserListSummaryResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.entity.UserList;
import com.srpfreaks.backend.entity.UserListItem;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.ListItemCount;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserListItemRepository;
import com.srpfreaks.backend.repository.UserListRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 내 리스트 (D76): 이름을 붙여 오래 두는 개인 곡 모음. 세트리스트(오늘 칠 곡 임시 목록)와 별개이고 나만 본다.
 *
 * 소유자 검증: 모든 조회·변경이 userId(토큰에서만 옴)로 리스트를 먼저 찾는다(findByIdAndUserId). 남의 리스트는 없는 리스트와
 * 똑같이 404라서 존재 여부도 알 수 없다. 항목은 항상 이렇게 찾은 내 리스트 id로만 다룬다.
 *
 * 이름: NFKC 정규화 + 앞뒤 공백 제거한 값을 저장하고, 같은 이름은 대소문자 구분 없이 중복 불가(400). 원문 그대로가 아니라 정리한 값을
 * 저장하는 이유: 전각/반각 차이로 같은 이름이 둘 생기는 것을 막고, 비교와 저장이 같은 값이라 DB UNIQUE와 서비스 검사가 어긋나지 않게 하려는 것이다.
 * 대소문자는 바꾸지 않는다(화면에는 사용자가 쓴 대로 보인다).
 *
 * 달성률·단계는 저장하지 않고 내 기록에서 계산한다. 목록 한 번에 쿼리는 항목(+채보+곡) 1번, 내 최고 기록 1번, 서열표 찾기 1번 + 난이도 1번으로 고정이다(N+1 없음).
 * 삭제된(소프트 삭제) 곡·채보는 응답과 곡 수에서 뺀다. 리스트·항목 삭제는 소프트 삭제 없이 행을 지운다(DESIGN.md D76).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserListService {

    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 100;

    private final UserListRepository userListRepository;
    private final UserListItemRepository userListItemRepository;
    private final UserRepository userRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final OptionRecordRepository optionRecordRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final DifficultyTableEntryRepository difficultyTableEntryRepository;
    private final AppSettingRepository appSettingRepository;

    /**
     * 내 리스트 목록(순서대로). songDifficultyId를 주면 각 리스트에 그 채보가 담겨 있는지(contains)를 함께 알려 준다(곡 상세의 담기 시트용, 쿼리 1번 추가).
     * 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(목록 API 공통 방식).
     */
    @Transactional(readOnly = true)
    public PageResponse<UserListSummaryResponse> list(Long userId, Long songDifficultyId, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<UserList> lists = userListRepository.findByUserId(userId,
                PageRequest.of(Math.max(page, 0), pageSize, Sort.by("sortOrder", "id")));
        List<Long> ids = lists.getContent().stream().map(UserList::getId).toList();
        Map<Long, Long> counts = countsOf(ids);
        Set<Long> containing = songDifficultyId == null ? Set.of()
                : new HashSet<>(userListItemRepository.findListIdsContaining(userId, songDifficultyId));
        return new PageResponse<>(lists.getContent().stream()
                .map(l -> UserListSummaryResponse.of(l, counts.getOrDefault(l.getId(), 0L),
                        songDifficultyId == null ? null : containing.contains(l.getId())))
                .toList(), lists.getNumber(), lists.getSize(), lists.getTotalElements(), lists.getTotalPages());
    }

    public UserListSummaryResponse create(Long userId, String rawName) {
        String name = normalizeName(rawName);
        UserListConfig config = UserListConfig.load(appSettingRepository);
        if (userListRepository.countByUserId(userId) >= config.maxLists()) {
            throw new ApiException(ErrorCode.LIST_LIMIT);
        }
        if (userListRepository.countSameName(userId, name, null) > 0) {
            throw new ApiException(ErrorCode.LIST_NAME_DUPLICATE);
        }
        Integer max = userListRepository.findMaxSortOrder(userId);
        UserList saved = saveName(() -> userListRepository.saveAndFlush(
                UserList.create(userRepository.getReferenceById(userId), name, max == null ? 0 : max + 1)));
        return UserListSummaryResponse.of(saved, 0, null);
    }

    public UserListSummaryResponse rename(Long userId, Long listId, String rawName) {
        UserList list = ownedList(userId, listId);
        String name = normalizeName(rawName);
        if (userListRepository.countSameName(userId, name, listId) > 0) {
            throw new ApiException(ErrorCode.LIST_NAME_DUPLICATE);
        }
        list.rename(name);
        saveName(() -> userListRepository.saveAndFlush(list));
        return UserListSummaryResponse.of(list, userListItemRepository.countVisibleByListId(listId), null);
    }

    /** 리스트를 지운다. 항목은 DB의 ON DELETE CASCADE로 함께 지워진다(소프트 삭제 없음). */
    public void delete(Long userId, Long listId) {
        userListRepository.delete(ownedList(userId, listId));
    }

    @Transactional(readOnly = true)
    public UserListDetailResponse detail(Long userId, Long listId, int page, int size) {
        UserList list = ownedList(userId, listId);
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<UserListItem> items = userListItemRepository.findVisibleByListId(listId, PageRequest.of(Math.max(page, 0), pageSize));
        // 채보별 조회(최고 기록·난이도)를 한 번씩만 하려고 줄 전체를 한꺼번에 응답으로 바꾼다
        PageResponse<UserListItemResponse> body = new PageResponse<>(toResponses(userId, items.getContent()),
                items.getNumber(), items.getSize(), items.getTotalElements(), items.getTotalPages());
        return new UserListDetailResponse(list.getId(), list.getName(), items.getTotalElements(), body);
    }

    /**
     * 곡을 담는다. 이미 담겨 있으면 오류 없이 alreadyContained=true로 성공 처리한다(곡 상세 토글 연타에도 오류가 뜨지 않게).
     * 채보가 없거나 삭제됐으면 404, 곡 수 상한(list.max_items)을 넘으면 400.
     */
    public UserListAddItemResponse addItem(Long userId, Long listId, Long songDifficultyId) {
        UserList list = ownedList(userId, listId);
        SongDifficulty chart = songDifficultyRepository.findByIdAndDeletedFalse(songDifficultyId)
                .filter(d -> !d.getSong().isDeleted())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        long count = userListItemRepository.countVisibleByListId(listId);
        if (userListItemRepository.findByUserListIdAndSongDifficultyId(listId, songDifficultyId).isPresent()) {
            return new UserListAddItemResponse(true, count);
        }
        if (count >= UserListConfig.load(appSettingRepository).maxItems()) {
            throw new ApiException(ErrorCode.LIST_ITEMS_LIMIT);
        }
        Integer max = userListItemRepository.findMaxSortOrder(listId);
        try {
            userListItemRepository.saveAndFlush(UserListItem.create(list, chart, max == null ? 0 : max + 1));
        } catch (DataIntegrityViolationException e) {
            // 거의 동시에 같은 곡을 담은 요청과 겹친 경우(UNIQUE): 이미 담긴 것으로 본다
            return new UserListAddItemResponse(true, count);
        }
        return new UserListAddItemResponse(false, count + 1);
    }

    /** 곡을 뺀다. 담겨 있지 않아도 오류 없이 끝난다(토글을 연타해도 오류가 뜨지 않게). */
    public void removeItem(Long userId, Long listId, Long songDifficultyId) {
        ownedList(userId, listId);
        userListItemRepository.findByUserListIdAndSongDifficultyId(listId, songDifficultyId)
                .ifPresent(userListItemRepository::delete);
    }

    /**
     * 곡 순서를 바꾼다. 보낸 채보 id들을 그 순서대로 앞에 놓고, 보내지 않은 줄(삭제된 채보의 숨은 줄 등)은 원래 순서로 뒤에 둔다.
     * 이 리스트에 없는 채보나 중복 id가 있으면 400.
     */
    public void reorder(Long userId, Long listId, List<Long> orderedChartIds) {
        ownedList(userId, listId);
        List<UserListItem> all = userListItemRepository.findAllByListId(listId);
        if (orderedChartIds == null || orderedChartIds.size() > UserListConfig.load(appSettingRepository).maxItems()
                || new HashSet<>(orderedChartIds).size() != orderedChartIds.size()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        Map<Long, UserListItem> byChart = new HashMap<>();
        all.forEach(i -> byChart.put(i.getSongDifficulty().getId(), i));
        int next = 0;
        for (Long chartId : orderedChartIds) {
            UserListItem item = byChart.remove(chartId);
            if (item == null) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR);
            }
            item.moveTo(next++);
        }
        for (UserListItem rest : all) {
            if (byChart.containsKey(rest.getSongDifficulty().getId())) {
                rest.moveTo(next++);
            }
        }
    }

    /** 이름을 NFKC로 정규화하고 앞뒤 공백을 지운다. 비었거나 20자(글자 수, 코드포인트 기준)를 넘거나 제어 문자가 있으면 400. */
    static String normalizeName(String raw) {
        if (raw == null) {
            throw new ApiException(ErrorCode.LIST_NAME_INVALID);
        }
        String name = Normalizer.normalize(raw, Normalizer.Form.NFKC).strip();
        int length = name.codePointCount(0, name.length());
        if (length < 1 || length > UserList.NAME_MAX_LENGTH || name.codePoints().anyMatch(Character::isISOControl)) {
            throw new ApiException(ErrorCode.LIST_NAME_INVALID);
        }
        return name;
    }

    private UserList ownedList(Long userId, Long listId) {
        return userListRepository.findByIdAndUserId(listId, userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }

    /** DB UNIQUE(user_id, name)에 걸리면(거의 동시에 같은 이름을 만든 경우) 중복 이름 400으로 바꾼다. */
    private <T> T saveName(java.util.function.Supplier<T> save) {
        try {
            return save.get();
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.LIST_NAME_DUPLICATE);
        }
    }

    private Map<Long, Long> countsOf(List<Long> listIds) {
        Map<Long, Long> counts = new HashMap<>();
        if (listIds.isEmpty()) {
            return counts;
        }
        for (ListItemCount c : userListItemRepository.countVisibleByListIds(listIds)) {
            counts.put(c.listId(), c.count());
        }
        return counts;
    }

    private List<UserListItemResponse> toResponses(Long userId, List<UserListItem> items) {
        if (items.isEmpty()) {
            return List.of();
        }
        List<Long> chartIds = items.stream().map(i -> i.getSongDifficulty().getId()).toList();
        Map<Long, RecordBest> bests = new HashMap<>();
        // 최고 기록은 사용자의 전체 채보 대상이지만 쿼리 1번이고 세트리스트와 같은 방식이라 재사용한다
        optionRecordRepository.findBestByUser(userId, SetlistService.RECORD_OPTION).forEach(b -> bests.put(b.songDifficultyId(), b));
        Map<Long, DifficultyTableEntry> entries = entriesOf(chartIds);
        return items.stream().map(i -> {
            Long chartId = i.getSongDifficulty().getId();
            RecordBest best = bests.get(chartId);
            MyRecord mine = best == null ? null
                    : new MyRecord(best.bestRate(), best.fullCombo(), AchievementStage.of(best.bestRate(), best.fullCombo()));
            DifficultyTableEntry entry = entries.get(chartId);
            BigDecimal tier = entry == null ? null : entry.getTierLabel();
            String pattern = entry == null || entry.getPatternType() == null ? null : entry.getPatternType().getLabel();
            return UserListItemResponse.of(i, tier, pattern, mine);
        }).toList();
    }

    /** SRN+ 활성 서열표에서 채보별 서열표 항목(기준 난이도 T와 속성). 표가 없거나 서열표에 없는 채보는 맵에 없다(SetlistService와 같은 방식). */
    private Map<Long, DifficultyTableEntry> entriesOf(List<Long> chartIds) {
        Map<Long, DifficultyTableEntry> entries = new HashMap<>();
        Optional<DifficultyTable> table = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(SetlistService.RECORD_OPTION, TableStatus.ACTIVE);
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
