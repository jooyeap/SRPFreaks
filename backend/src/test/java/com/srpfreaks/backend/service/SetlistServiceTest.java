package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SetlistItemResponse;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.SetlistItem;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.RecordLatestUpdate;
import com.srpfreaks.backend.repository.SetlistItemRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SetlistServiceTest {

    static final Instant ADDED = Instant.parse("2026-10-16T05:00:00Z");

    @Mock SetlistItemRepository setlistItemRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock OptionRecordRepository optionRecordRepository;
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock DifficultyTableEntryRepository difficultyTableEntryRepository;
    @Mock UserRepository userRepository;

    SetlistService service;
    final User user = User.create("sub", "a@example.com", "tester");
    final Song song = Song.create("곡", "아티스트", "test", user);

    @BeforeEach
    void setUp() {
        service = new SetlistService(setlistItemRepository, songDifficultyRepository, optionRecordRepository,
                difficultyTableRepository, difficultyTableEntryRepository, userRepository);
    }

    private SongDifficulty chart(long id) {
        SongDifficulty chart = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        ReflectionTestUtils.setField(chart, "id", id);
        return chart;
    }

    private SetlistItem item(long id, SongDifficulty chart) {
        SetlistItem item = SetlistItem.create(user, chart);
        ReflectionTestUtils.setField(item, "id", id);
        ReflectionTestUtils.setField(item, "createdAt", ADDED);
        return item;
    }

    @Test
    void 채보를_담으면_저장하고_응답을_돌려준다() {
        SongDifficulty chart = chart(10L);
        when(songDifficultyRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(chart));
        when(setlistItemRepository.existsByUserIdAndSongDifficultyId(1L, 10L)).thenReturn(false);
        when(setlistItemRepository.countActiveByUserId(1L)).thenReturn(0L);
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(setlistItemRepository.save(any(SetlistItem.class))).thenAnswer(inv -> {
            SetlistItem saved = inv.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 5L);
            ReflectionTestUtils.setField(saved, "createdAt", ADDED);
            return saved;
        });
        when(optionRecordRepository.findLatestUpdates(eq(1L), eq(NoteOption.SUPER_RANDOM_PLUS), anyCollection())).thenReturn(List.of());
        when(optionRecordRepository.findBestByUser(1L, NoteOption.SUPER_RANDOM_PLUS)).thenReturn(List.of());
        when(difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE))
                .thenReturn(Optional.empty());

        SetlistItemResponse response = service.add(1L, 10L);

        assertThat(response.id()).isEqualTo(5L);
        assertThat(response.songDifficultyId()).isEqualTo(10L);
        assertThat(response.done()).isFalse();
        assertThat(response.mine()).isNull();
        assertThat(response.tier()).isNull();
    }

    @Test
    void 이미_담은_채보는_거부한다() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(chart(10L)));
        when(setlistItemRepository.existsByUserIdAndSongDifficultyId(1L, 10L)).thenReturn(true);

        assertThatThrownBy(() -> service.add(1L, 10L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
        verify(setlistItemRepository, never()).save(any());
    }

    @Test
    void 삭제됐거나_없는_채보는_404다() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.add(1L, 99L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    void 삭제된_곡의_채보도_담을_수_없다() {
        Song deletedSong = Song.create("지운 곡", "아티스트", "test", user);
        deletedSong.delete();
        SongDifficulty chart = SongDifficulty.create(deletedSong, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        when(songDifficultyRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(chart));

        assertThatThrownBy(() -> service.add(1L, 10L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    void 서른_곡이_차_있으면_더_담을_수_없다() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(chart(10L)));
        when(setlistItemRepository.existsByUserIdAndSongDifficultyId(1L, 10L)).thenReturn(false);
        when(setlistItemRepository.countActiveByUserId(1L)).thenReturn((long) SetlistItem.MAX_ITEMS);

        assertThatThrownBy(() -> service.add(1L, 10L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.SETLIST_FULL));
        verify(setlistItemRepository, never()).save(any());
    }

    @Test
    void 남의_줄을_빼려_하면_404다() {
        when(setlistItemRepository.findByIdAndUserId(7L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.remove(1L, 7L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(setlistItemRepository, never()).delete(any());
    }

    @Test
    void 내_줄은_뺄_수_있다() {
        SetlistItem mine = item(7L, chart(10L));
        when(setlistItemRepository.findByIdAndUserId(7L, 1L)).thenReturn(Optional.of(mine));

        service.remove(1L, 7L);

        verify(setlistItemRepository).delete(mine);
    }

    @Test
    void 목록은_담은_뒤_저장한_기록만_완료로_표시하고_내_최고_기록과_난이도를_붙인다() {
        SetlistItem done = item(1L, chart(10L));      // 담은 뒤에 저장함
        SetlistItem stale = item(2L, chart(20L));     // 담기 전 기록만 있음
        SetlistItem none = item(3L, chart(30L));      // 기록 없음
        when(setlistItemRepository.findActiveByUserId(eq(1L), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(done, stale, none)));
        when(optionRecordRepository.findLatestUpdates(eq(1L), eq(NoteOption.SUPER_RANDOM_PLUS), anyCollection())).thenReturn(List.of(
                new RecordLatestUpdate(10L, ADDED.plusSeconds(60)), new RecordLatestUpdate(20L, ADDED.minusSeconds(60))));
        when(optionRecordRepository.findBestByUser(1L, NoteOption.SUPER_RANDOM_PLUS)).thenReturn(List.of(
                new RecordBest(10L, new BigDecimal("96.50"), false), new RecordBest(20L, new BigDecimal("80.00"), false)));
        DifficultyTable table = DifficultyTable.create("표", null, NoteOption.SUPER_RANDOM_PLUS);
        ReflectionTestUtils.setField(table, "id", 3L);
        when(difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE))
                .thenReturn(Optional.of(table));
        DifficultyTableEntry entry = DifficultyTableEntry.create(table, chart(10L));
        entry.changeTier(new BigDecimal("6.2"), false, null);
        entry.changePattern(PatternType.COMPOUND, false);
        when(difficultyTableEntryRepository.findByDifficultyTableIdAndSongDifficultyIdIn(eq(3L), anyCollection())).thenReturn(List.of(entry));

        PageResponse<SetlistItemResponse> page = service.list(1L, -1, 1000);

        assertThat(page.content()).extracting(SetlistItemResponse::done).containsExactly(true, false, false);
        assertThat(page.content().get(0).mine().rate()).isEqualByComparingTo("96.50");
        assertThat(page.content().get(0).tier()).isEqualByComparingTo("6.2");
        // 속성은 서열표에 적힌 글자 그대로, 서열표에 없는 채보는 null
        assertThat(page.content().get(0).pattern()).isEqualTo("복합");
        assertThat(page.content().get(1).pattern()).isNull();
        assertThat(page.content().get(2).mine()).isNull();
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(setlistItemRepository).findActiveByUserId(eq(1L), captor.capture());
        assertThat(captor.getValue().getPageNumber()).isZero();
        assertThat(captor.getValue().getPageSize()).isEqualTo(SetlistItem.MAX_ITEMS);
    }

    @Test
    void 완료한_줄만_비운다() {
        SetlistItem done = item(1L, chart(10L));
        SetlistItem notYet = item(2L, chart(20L));
        when(setlistItemRepository.findAllByUserId(1L)).thenReturn(List.of(done, notYet));
        when(optionRecordRepository.findLatestUpdates(eq(1L), eq(NoteOption.SUPER_RANDOM_PLUS), anyCollection()))
                .thenReturn(List.of(new RecordLatestUpdate(10L, ADDED.plusSeconds(1))));

        int removed = service.clearDone(1L);

        assertThat(removed).isEqualTo(1);
        verify(setlistItemRepository).deleteAll(List.of(done));
    }
}
