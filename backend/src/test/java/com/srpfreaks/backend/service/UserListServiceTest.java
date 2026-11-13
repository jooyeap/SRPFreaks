package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.UserListAddItemResponse;
import com.srpfreaks.backend.dto.UserListDetailResponse;
import com.srpfreaks.backend.dto.UserListSummaryResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 내 리스트(D76) 서비스. DB 없이 저장소를 가짜로 두고 이름 정리·소유자 404·상한 400·중복 담기·순서 규칙을 확인한다.
 * 쿼리 자체(삭제된 채보 제외, 곡 수 집계, UNIQUE, 탈퇴·리스트 삭제 때 CASCADE)는 UserListRepositoryTest(Testcontainers)가 확인한다.
 */
@ExtendWith(MockitoExtension.class)
class UserListServiceTest {

    static final long ME = 7L;
    static final long OTHER = 8L;
    static final long LIST = 30L;

    @Mock UserListRepository userListRepository;
    @Mock UserListItemRepository userListItemRepository;
    @Mock UserRepository userRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock OptionRecordRepository optionRecordRepository;
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock DifficultyTableEntryRepository difficultyTableEntryRepository;
    @Mock AppSettingRepository appSettingRepository;

    UserListService service;
    User me;
    UserList mine;

    @BeforeEach
    void setUp() {
        service = new UserListService(userListRepository, userListItemRepository, userRepository, songDifficultyRepository,
                optionRecordRepository, difficultyTableRepository, difficultyTableEntryRepository, appSettingRepository);
        me = User.create("sub-me", "me@example.com", "meme");
        mine = UserList.create(me, "연습", 0);
        ReflectionTestUtils.setField(mine, "id", LIST);
        // 상한 설정: 리스트 3개, 리스트당 곡 2개(테스트에서 쉽게 넘기려고 작게 둔다)
        lenient().when(appSettingRepository.findAll()).thenReturn(List.of(
                AppSetting.create("list.max_lists", "3", null), AppSetting.create("list.max_items", "2", null)));
        lenient().when(userListRepository.findByIdAndUserId(LIST, ME)).thenReturn(Optional.of(mine));
        lenient().when(userListRepository.findByIdAndUserId(LIST, OTHER)).thenReturn(Optional.empty());
        lenient().when(userRepository.getReferenceById(ME)).thenReturn(me);
    }

    private SongDifficulty chart(long id) {
        Song song = Song.create("곡" + id, "A", "test", me);
        ReflectionTestUtils.setField(song, "id", 100 + id);
        SongDifficulty d = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.00"));
        ReflectionTestUtils.setField(d, "id", id);
        return d;
    }

    private UserListItem item(long chartId, int order) {
        UserListItem i = UserListItem.create(mine, chart(chartId), order);
        ReflectionTestUtils.setField(i, "id", 1000 + chartId);
        return i;
    }

    private void assertCode(Runnable call, ErrorCode code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }

    // ----- 이름 -----

    @Test
    void 이름은_NFKC로_정리하고_앞뒤_공백을_지운다_대소문자는_그대로() {
        assertThat(UserListService.normalizeName("  Ｐｒａｃｔｉｃｅ １  ")).isEqualTo("Practice 1");  // 전각 -> 반각, 앞뒤 공백 제거
        assertThat(UserListService.normalizeName("연습곡 모음")).isEqualTo("연습곡 모음");
        assertThat(UserListService.normalizeName("MixedCase")).isEqualTo("MixedCase");
    }

    @Test
    void 비었거나_공백만이거나_20자를_넘거나_제어문자가_있으면_400() {
        assertCode(() -> UserListService.normalizeName(null), ErrorCode.LIST_NAME_INVALID);
        assertCode(() -> UserListService.normalizeName(""), ErrorCode.LIST_NAME_INVALID);
        assertCode(() -> UserListService.normalizeName("   "), ErrorCode.LIST_NAME_INVALID);
        assertCode(() -> UserListService.normalizeName("　　"), ErrorCode.LIST_NAME_INVALID);    // 전각 공백만
        assertCode(() -> UserListService.normalizeName("a".repeat(21)), ErrorCode.LIST_NAME_INVALID);
        assertCode(() -> UserListService.normalizeName("줄\n바꿈"), ErrorCode.LIST_NAME_INVALID);
        assertThat(UserListService.normalizeName("a".repeat(20))).hasSize(20);                  // 경계: 20자는 통과
    }

    @Test
    void 이모지도_한_글자로_센다() {
        // 코드포인트 기준이라 20개의 이모지는 통과(DB의 CHAR_LENGTH와 같은 기준)
        assertThat(UserListService.normalizeName("😀".repeat(20))).isNotEmpty();
        assertCode(() -> UserListService.normalizeName("😀".repeat(21)), ErrorCode.LIST_NAME_INVALID);
    }

    // ----- 만들기·이름 바꾸기 -----

    @Test
    void 리스트를_만들면_정리한_이름으로_맨_뒤에_둔다() {
        when(userListRepository.countByUserId(ME)).thenReturn(1L);
        when(userListRepository.countSameName(ME, "Practice", null)).thenReturn(0L);
        when(userListRepository.findMaxSortOrder(ME)).thenReturn(4);
        when(userListRepository.saveAndFlush(any(UserList.class))).thenAnswer(i -> i.getArgument(0));

        UserListSummaryResponse created = service.create(ME, " Ｐｒａｃｔｉｃｅ ");

        assertThat(created.name()).isEqualTo("Practice");
        assertThat(created.itemCount()).isZero();
        org.mockito.ArgumentCaptor<UserList> saved = org.mockito.ArgumentCaptor.forClass(UserList.class);
        verify(userListRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getSortOrder()).isEqualTo(5);
    }

    @Test
    void 리스트_수_상한을_넘으면_400() {
        when(userListRepository.countByUserId(ME)).thenReturn(3L);
        assertCode(() -> service.create(ME, "새 리스트"), ErrorCode.LIST_LIMIT);
        verify(userListRepository, never()).saveAndFlush(any(UserList.class));
    }

    @Test
    void 같은_이름이면_400_대소문자_구분_없음은_저장소_조회가_맡는다() {
        when(userListRepository.countByUserId(ME)).thenReturn(0L);
        when(userListRepository.countSameName(ME, "PRACTICE", null)).thenReturn(1L);
        assertCode(() -> service.create(ME, "PRACTICE"), ErrorCode.LIST_NAME_DUPLICATE);
        verify(userListRepository, never()).saveAndFlush(any(UserList.class));
    }

    @Test
    void 거의_동시에_같은_이름을_만들어_DB_UNIQUE에_걸려도_중복_이름_400() {
        when(userListRepository.countByUserId(ME)).thenReturn(0L);
        when(userListRepository.countSameName(ME, "연습", null)).thenReturn(0L);
        when(userListRepository.saveAndFlush(any(UserList.class))).thenThrow(new DataIntegrityViolationException("dup"));
        assertCode(() -> service.create(ME, "연습"), ErrorCode.LIST_NAME_DUPLICATE);
    }

    @Test
    void 이름을_바꿀_때는_자기_자신을_뺀_중복만_본다() {
        when(userListRepository.countSameName(ME, "연습", LIST)).thenReturn(0L);
        when(userListRepository.saveAndFlush(any(UserList.class))).thenAnswer(i -> i.getArgument(0));
        when(userListItemRepository.countVisibleByListId(LIST)).thenReturn(2L);

        UserListSummaryResponse renamed = service.rename(ME, LIST, "연습");

        assertThat(renamed.name()).isEqualTo("연습");
        assertThat(renamed.itemCount()).isEqualTo(2L);
        verify(userListRepository).countSameName(ME, "연습", LIST);
    }

    @Test
    void 다른_리스트와_같은_이름으로_바꾸면_400() {
        when(userListRepository.countSameName(ME, "다른", LIST)).thenReturn(1L);
        assertCode(() -> service.rename(ME, LIST, "다른"), ErrorCode.LIST_NAME_DUPLICATE);
    }

    // ----- 소유자 검증 -----

    @Test
    void 남의_리스트는_모든_동작이_404() {
        assertCode(() -> service.detail(OTHER, LIST, 0, 10), ErrorCode.NOT_FOUND);
        assertCode(() -> service.rename(OTHER, LIST, "이름"), ErrorCode.NOT_FOUND);
        assertCode(() -> service.delete(OTHER, LIST), ErrorCode.NOT_FOUND);
        assertCode(() -> service.addItem(OTHER, LIST, 1L), ErrorCode.NOT_FOUND);
        assertCode(() -> service.removeItem(OTHER, LIST, 1L), ErrorCode.NOT_FOUND);
        assertCode(() -> service.reorder(OTHER, LIST, List.of(1L)), ErrorCode.NOT_FOUND);
        verify(userListRepository, never()).delete(any(UserList.class));
        verify(userListItemRepository, never()).saveAndFlush(any(UserListItem.class));
    }

    @Test
    void 지울_때는_내_리스트만_지운다() {
        service.delete(ME, LIST);
        verify(userListRepository).delete(mine);
    }

    // ----- 목록·상세 -----

    @Test
    void 목록은_곡_수와_담김_여부를_쿼리_한_번씩으로_채운다() {
        UserList second = UserList.create(me, "두번째", 1);
        ReflectionTestUtils.setField(second, "id", 31L);
        when(userListRepository.findByUserId(any(Long.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(mine, second), PageRequest.of(0, 10), 2));
        when(userListItemRepository.countVisibleByListIds(anyCollection())).thenReturn(List.of(new ListItemCount(LIST, 5L)));
        when(userListItemRepository.findListIdsContaining(ME, 77L)).thenReturn(List.of(31L));

        PageResponse<UserListSummaryResponse> page = service.list(ME, 77L, 0, 10);

        assertThat(page.content()).extracting(UserListSummaryResponse::itemCount).containsExactly(5L, 0L);   // 곡이 없는 리스트는 0
        assertThat(page.content()).extracting(UserListSummaryResponse::contains).containsExactly(false, true);
        verify(userListItemRepository, times(1)).countVisibleByListIds(anyCollection());   // 리스트 수와 상관없이 한 번
        verify(userListItemRepository, times(1)).findListIdsContaining(ME, 77L);
    }

    @Test
    void 채보를_주지_않으면_contains는_null이고_담김_조회도_하지_않는다() {
        when(userListRepository.findByUserId(any(Long.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(mine), PageRequest.of(0, 10), 1));
        when(userListItemRepository.countVisibleByListIds(anyCollection())).thenReturn(List.of());

        PageResponse<UserListSummaryResponse> page = service.list(ME, null, 0, 10);

        assertThat(page.content().get(0).contains()).isNull();
        verify(userListItemRepository, never()).findListIdsContaining(anyLong(), anyLong());
    }

    @Test
    void 상세는_내_기록을_한_번에_조회해_달성률과_단계를_붙인다() {
        UserListItem a = item(1L, 0);
        UserListItem b = item(2L, 1);
        when(userListItemRepository.findVisibleByListId(any(Long.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(a, b), PageRequest.of(0, 100), 2));
        when(optionRecordRepository.findBestByUser(ME, SetlistService.RECORD_OPTION))
                .thenReturn(List.of(new RecordBest(1L, new BigDecimal("96.50"), false)));
        when(difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(any(), any())).thenReturn(Optional.empty());

        UserListDetailResponse detail = service.detail(ME, LIST, 0, 100);

        assertThat(detail.name()).isEqualTo("연습");
        assertThat(detail.itemCount()).isEqualTo(2);
        assertThat(detail.items().content().get(0).mine().rate()).isEqualByComparingTo("96.50");
        assertThat(detail.items().content().get(1).mine()).isNull();                 // 기록이 없으면 null
        verify(optionRecordRepository, times(1)).findBestByUser(ME, SetlistService.RECORD_OPTION);   // 곡 수와 상관없이 한 번
    }

    // ----- 담기·빼기 -----

    @Test
    void 곡을_담으면_맨_뒤에_두고_곡_수를_돌려준다() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(5L)).thenReturn(Optional.of(chart(5L)));
        when(userListItemRepository.countVisibleByListId(LIST)).thenReturn(1L);
        when(userListItemRepository.findByUserListIdAndSongDifficultyId(LIST, 5L)).thenReturn(Optional.empty());
        when(userListItemRepository.findMaxSortOrder(LIST)).thenReturn(0);

        UserListAddItemResponse result = service.addItem(ME, LIST, 5L);

        assertThat(result.alreadyContained()).isFalse();
        assertThat(result.itemCount()).isEqualTo(2L);
        org.mockito.ArgumentCaptor<UserListItem> saved = org.mockito.ArgumentCaptor.forClass(UserListItem.class);
        verify(userListItemRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getSortOrder()).isEqualTo(1);
    }

    @Test
    void 이미_담은_곡을_다시_담아도_오류_없이_성공한다() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(5L)).thenReturn(Optional.of(chart(5L)));
        when(userListItemRepository.countVisibleByListId(LIST)).thenReturn(2L);   // 상한(2)에 찬 상태여도
        when(userListItemRepository.findByUserListIdAndSongDifficultyId(LIST, 5L)).thenReturn(Optional.of(item(5L, 0)));

        UserListAddItemResponse result = service.addItem(ME, LIST, 5L);

        assertThat(result.alreadyContained()).isTrue();
        assertThat(result.itemCount()).isEqualTo(2L);
        verify(userListItemRepository, never()).saveAndFlush(any(UserListItem.class));   // 새로 저장하지 않는다
    }

    @Test
    void 거의_동시에_같은_곡을_담아_UNIQUE에_걸려도_이미_담긴_것으로_본다() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(5L)).thenReturn(Optional.of(chart(5L)));
        when(userListItemRepository.countVisibleByListId(LIST)).thenReturn(0L);
        when(userListItemRepository.findByUserListIdAndSongDifficultyId(LIST, 5L)).thenReturn(Optional.empty());
        when(userListItemRepository.findMaxSortOrder(LIST)).thenReturn(null);
        when(userListItemRepository.saveAndFlush(any(UserListItem.class))).thenThrow(new DataIntegrityViolationException("dup"));

        assertThat(service.addItem(ME, LIST, 5L).alreadyContained()).isTrue();
    }

    @Test
    void 곡_수_상한을_넘으면_400() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(5L)).thenReturn(Optional.of(chart(5L)));
        when(userListItemRepository.countVisibleByListId(LIST)).thenReturn(2L);
        when(userListItemRepository.findByUserListIdAndSongDifficultyId(LIST, 5L)).thenReturn(Optional.empty());

        assertCode(() -> service.addItem(ME, LIST, 5L), ErrorCode.LIST_ITEMS_LIMIT);
        verify(userListItemRepository, never()).saveAndFlush(any(UserListItem.class));
    }

    @Test
    void 없는_채보나_삭제된_곡의_채보는_담을_수_없다_404() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(9L)).thenReturn(Optional.empty());
        assertCode(() -> service.addItem(ME, LIST, 9L), ErrorCode.NOT_FOUND);

        SongDifficulty ofDeletedSong = chart(6L);
        ofDeletedSong.getSong().delete();
        when(songDifficultyRepository.findByIdAndDeletedFalse(6L)).thenReturn(Optional.of(ofDeletedSong));
        assertCode(() -> service.addItem(ME, LIST, 6L), ErrorCode.NOT_FOUND);
    }

    @Test
    void 담겨_있지_않은_곡을_빼도_오류_없이_끝난다() {
        when(userListItemRepository.findByUserListIdAndSongDifficultyId(LIST, 5L)).thenReturn(Optional.empty());
        service.removeItem(ME, LIST, 5L);
        verify(userListItemRepository, never()).delete(any(UserListItem.class));

        UserListItem existing = item(5L, 0);
        when(userListItemRepository.findByUserListIdAndSongDifficultyId(LIST, 5L)).thenReturn(Optional.of(existing));
        service.removeItem(ME, LIST, 5L);
        verify(userListItemRepository).delete(existing);
    }

    // ----- 순서 -----

    @Test
    void 순서를_바꾸면_보낸_순서대로_앞에_놓고_안_보낸_줄은_뒤에_둔다() {
        UserListItem a = item(1L, 0);
        UserListItem b = item(2L, 1);
        UserListItem hidden = item(3L, 2);   // 삭제된 채보의 숨은 줄처럼 화면 순서에 안 오는 줄
        when(userListItemRepository.findAllByListId(LIST)).thenReturn(new ArrayList<>(List.of(a, b, hidden)));

        service.reorder(ME, LIST, List.of(2L, 1L));

        assertThat(b.getSortOrder()).isZero();
        assertThat(a.getSortOrder()).isEqualTo(1);
        assertThat(hidden.getSortOrder()).isEqualTo(2);
    }

    @Test
    void 이_리스트에_없는_채보나_중복_id는_400() {
        when(userListItemRepository.findAllByListId(LIST)).thenReturn(new ArrayList<>(List.of(item(1L, 0), item(2L, 1))));
        assertCode(() -> service.reorder(ME, LIST, List.of(1L, 9L)), ErrorCode.VALIDATION_ERROR);
        assertCode(() -> service.reorder(ME, LIST, List.of(1L, 1L)), ErrorCode.VALIDATION_ERROR);
        assertCode(() -> service.reorder(ME, LIST, List.of(1L, 2L, 3L)), ErrorCode.VALIDATION_ERROR);   // 상한(2)을 넘는 개수
        assertCode(() -> service.reorder(ME, LIST, null), ErrorCode.VALIDATION_ERROR);
    }
}
