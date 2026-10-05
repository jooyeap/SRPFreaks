package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TierGroupResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Recommend;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DifficultyTableViewServiceTest {

    @Mock DifficultyTableRepository tableRepository;
    @Mock DifficultyTableEntryRepository entryRepository;
    @Mock OptionRecordRepository recordRepository;

    DifficultyTableViewService service;
    DifficultyTable table;
    long nextId = 1;

    @BeforeEach
    void setUp() {
        service = new DifficultyTableViewService(tableRepository, entryRepository, recordRepository);
        table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        lenient().when(tableRepository.findById(1L)).thenReturn(Optional.of(table));
    }

    /** 항목 하나를 만든다. tier가 null이면 미정. */
    private DifficultyTableEntry entry(String title, InstrumentPart part, String level, String tier,
                                       Recommend recommend, PatternType pattern) {
        Song song = Song.create(title, null, "test", null);
        ReflectionTestUtils.setField(song, "id", nextId);
        SongDifficulty d = SongDifficulty.create(song, part, DifficultyType.MASTER, new BigDecimal(level));
        ReflectionTestUtils.setField(d, "id", nextId);
        DifficultyTableEntry e = DifficultyTableEntry.create(table, d);
        ReflectionTestUtils.setField(e, "id", nextId);
        nextId++;
        e.changeTier(tier == null ? null : new BigDecimal(tier), false, null);
        e.changeRecommend(recommend, false);
        e.changePattern(pattern, false);
        return e;
    }

    private DifficultyTableEntry simple(String title, String level, String tier) {
        return entry(title, InstrumentPart.GUITAR, level, tier, Recommend.MIDDLE, PatternType.SINGLE);
    }

    private PageResponse<TierGroupResponse> call(boolean mine, int page, int size) {
        return service.entries(7L, 1L, null, null, null, mine, page, size);
    }

    @Test
    void 기준_난이도_높은_순으로_묶고_미정은_맨_뒤에_둔다() {
        when(entryRepository.findAllForView(1L)).thenReturn(List.of(
                simple("a", "9.00", "5.8"), simple("b", "9.10", null), simple("c", "9.20", "6.1"),
                simple("d", "9.30", "5.8")));

        List<TierGroupResponse> groups = call(false, 0, 10).content();

        assertThat(groups).extracting(TierGroupResponse::tier)
                .containsExactly(new BigDecimal("6.1"), new BigDecimal("5.8"), null);
        assertThat(groups.get(1).total()).isEqualTo(2);
    }

    @Test
    void 묶음_안은_레벨_높은_순이다() {
        when(entryRepository.findAllForView(1L)).thenReturn(List.of(
                simple("낮음", "9.00", "6.0"), simple("높음", "9.80", "6.0"), simple("중간", "9.50", "6.0")));

        assertThat(call(false, 0, 10).content().get(0).entries())
                .extracting(e -> e.title()).containsExactly("높음", "중간", "낮음");
    }

    @Test
    void mine이_false면_기록을_조회하지_않고_mine은_null이다() {
        when(entryRepository.findAllForView(1L)).thenReturn(List.of(simple("a", "9.00", "6.0")));

        TierGroupResponse group = call(false, 0, 10).content().get(0);

        assertThat(group.entries().get(0).mine()).isNull();
        assertThat(group.recorded()).isZero();
        verify(recordRepository, never()).findBestByTable(anyLong(), org.mockito.ArgumentMatchers.any(), anyLong());
    }

    @Test
    void 칩_개수는_채보당_가장_높은_단계_하나만_센다() {
        List<DifficultyTableEntry> list = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            list.add(simple("t" + i, "9.0" + i, "6.0"));
        }
        when(entryRepository.findAllForView(1L)).thenReturn(list);
        // 채보 1: EXC, 2: FC(96%), 3: SS, 4: S, 5: 70%(단계 없음), 6: 기록 없음
        when(recordRepository.findBestByTable(7L, NoteOption.SUPER_RANDOM_PLUS, 1L)).thenReturn(List.of(
                new RecordBest(1L, new BigDecimal("100.00"), true),
                new RecordBest(2L, new BigDecimal("96.00"), true),
                new RecordBest(3L, new BigDecimal("97.00"), false),
                new RecordBest(4L, new BigDecimal("85.00"), false),
                new RecordBest(5L, new BigDecimal("70.00"), false)));

        TierGroupResponse g = call(true, 0, 10).content().get(0);

        assertThat(g.total()).isEqualTo(6);
        assertThat(g.recorded()).isEqualTo(5);
        assertThat(g.exc()).isEqualTo(1);
        assertThat(g.fc()).isEqualTo(1);
        assertThat(g.ss()).isEqualTo(1);
        assertThat(g.s()).isEqualTo(1);
        // 칩 합(4) <= 기록 수(5): 80 미만은 어느 칩에도 안 들어간다
        assertThat(g.exc() + g.fc() + g.ss() + g.s()).isLessThanOrEqualTo(g.recorded());
        assertThat(g.entries()).filteredOn(e -> e.songDifficultyId() == 2L)
                .singleElement().satisfies(e -> assertThat(e.mine().stage()).isEqualTo(AchievementStage.FC));
    }

    @Test
    void 평균은_0퍼센트_미포함과_포함_두_가지를_낸다() {
        when(entryRepository.findAllForView(1L)).thenReturn(List.of(
                simple("a", "9.00", "6.0"), simple("b", "9.10", "6.0"), simple("c", "9.20", "6.0"),
                simple("d", "9.30", "6.0")));
        when(recordRepository.findBestByTable(7L, NoteOption.SUPER_RANDOM_PLUS, 1L)).thenReturn(List.of(
                new RecordBest(1L, new BigDecimal("90.00"), false),
                new RecordBest(2L, new BigDecimal("80.00"), false)));

        TierGroupResponse g = call(true, 0, 10).content().get(0);

        // 미포함: (90+80)/2 = 85.00, 포함: (90+80)/4 = 42.50
        assertThat(g.averageRecorded()).isEqualByComparingTo("85.00");
        assertThat(g.averageWithZero()).isEqualByComparingTo("42.50");
    }

    @Test
    void 기록이_없는_묶음은_미포함_평균이_null이고_포함_평균은_0이다() {
        when(entryRepository.findAllForView(1L)).thenReturn(List.of(simple("a", "9.00", "6.0")));
        when(recordRepository.findBestByTable(7L, NoteOption.SUPER_RANDOM_PLUS, 1L)).thenReturn(List.of());

        TierGroupResponse g = call(true, 0, 10).content().get(0);

        assertThat(g.averageRecorded()).isNull();
        assertThat(g.averageWithZero()).isEqualByComparingTo("0.00");
    }

    @Test
    void 파트_추천_속성_필터를_적용한다() {
        when(entryRepository.findAllForView(1L)).thenReturn(List.of(
                entry("기타상단일", InstrumentPart.GUITAR, "9.00", "6.0", Recommend.HIGH, PatternType.SINGLE),
                entry("베이스상단일", InstrumentPart.BASS, "9.00", "6.0", Recommend.HIGH, PatternType.SINGLE),
                entry("기타하복합", InstrumentPart.GUITAR, "9.00", "6.0", Recommend.LOW, PatternType.COMPOUND)));

        List<TierGroupResponse> groups = service.entries(7L, 1L, InstrumentPart.GUITAR, "상", "단일", false, 0, 10).content();

        assertThat(groups).hasSize(1);
        assertThat(groups.get(0).entries()).extracting(e -> e.title()).containsExactly("기타상단일");
        assertThat(groups.get(0).entries().get(0).recommend()).isEqualTo("상");
        assertThat(groups.get(0).entries().get(0).pattern()).isEqualTo("단일");
    }

    @Test
    void 알_수_없는_필터_값은_400이다() {
        assertThatThrownBy(() -> service.entries(7L, 1L, null, "최상", null, false, 0, 10))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.entries(7L, 1L, null, null, "없는속성", false, 0, 10))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void 없는_서열표는_404다() {
        when(tableRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.entries(7L, 99L, null, null, null, false, 0, 10))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void 묶음_단위로_페이지를_나누고_크기_상한을_둔다() {
        List<DifficultyTableEntry> list = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            list.add(simple("t" + i, "9.00", "5." + (i % 10)));
        }
        // tier는 5.0~5.9 열 가지뿐이므로 묶음은 10개
        when(entryRepository.findAllForView(1L)).thenReturn(list);

        PageResponse<TierGroupResponse> p = call(false, 1, 4);

        assertThat(p.totalElements()).isEqualTo(10);
        assertThat(p.totalPages()).isEqualTo(3);
        assertThat(p.content()).hasSize(4);
        assertThat(call(false, 5, 4).content()).isEmpty();
        assertThat(call(false, 0, 1000).size()).isEqualTo(DifficultyTableViewService.MAX_PAGE_SIZE);
    }
}
