package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.dto.ChartSort;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RateBucketResponse;
import com.srpfreaks.backend.dto.RateFolderListResponse;
import com.srpfreaks.backend.dto.RateFolderResponse;
import com.srpfreaks.backend.dto.TableEntryResponse;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.RateBucket;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 마이페이지 통계: 구간별 개수, MAX/FC 따로 세기, 레벨 폴더 묶기, 사용자 범위. */
@ExtendWith(MockitoExtension.class)
class RateFolderServiceTest {

    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock OptionRecordRepository optionRecordRepository;
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock DifficultyTableEntryRepository entryRepository;

    RateFolderService service;
    final List<SongDifficulty> charts = new ArrayList<>();
    long nextId = 1;

    @BeforeEach
    void setUp() {
        service = new RateFolderService(songDifficultyRepository, optionRecordRepository,
                difficultyTableRepository, entryRepository);
    }

    private SongDifficulty chart(String level) {
        Song song = Song.create("song" + nextId, null, "test", null);
        ReflectionTestUtils.setField(song, "id", nextId);
        SongDifficulty d = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal(level));
        ReflectionTestUtils.setField(d, "id", nextId);
        nextId++;
        charts.add(d);
        return d;
    }

    private static RecordBest best(long chartId, String rate, boolean fullCombo) {
        return new RecordBest(chartId, new BigDecimal(rate), fullCombo);
    }

    private static RateBucketResponse bucket(RateFolderResponse folder, RateBucket bucket) {
        return folder.buckets().stream().filter(b -> b.bucket() == bucket).findFirst().orElseThrow();
    }

    @Test
    void 구간별_개수와_MAX_FC를_따로_센다() {
        RateFolderResponse folder = RateFolderService.toFolder(new BigDecimal("8.00"), Arrays.asList(
                best(1, "100.00", true),    // MAX (FC 표시가 켜져 있어도 MAX로만 센다)
                best(2, "98.00", true),     // 95 구간 + FC
                best(3, "96.00", false),    // 95 구간
                best(4, "90.00", false),    // 90 구간
                best(5, "89.99", true),     // 85 구간 + FC (낮은 달성률의 FC도 그 구간에서 센다)
                best(6, "80.00", false),
                best(7, "73.00", false),
                best(8, "50.00", false),    // 73 미만
                null,                       // 미플레이
                null));

        assertThat(folder.total()).isEqualTo(10);
        assertThat(folder.recorded()).isEqualTo(8);
        RateBucketResponse top = bucket(folder, RateBucket.R95);
        assertThat(top.count()).isEqualTo(3);
        assertThat(top.exc()).isEqualTo(1);
        assertThat(top.fc()).isEqualTo(1);          // 100.00은 FC에 중복해서 세지 않는다
        assertThat(bucket(folder, RateBucket.R90).count()).isEqualTo(1);
        RateBucketResponse r85 = bucket(folder, RateBucket.R85);
        assertThat(r85.count()).isEqualTo(1);
        assertThat(r85.fc()).isEqualTo(1);
        assertThat(bucket(folder, RateBucket.R80).count()).isEqualTo(1);
        assertThat(bucket(folder, RateBucket.R73).count()).isEqualTo(1);
        assertThat(bucket(folder, RateBucket.BELOW).count()).isEqualTo(1);
        assertThat(bucket(folder, RateBucket.UNPLAYED).count()).isEqualTo(2);
    }

    @Test
    void 구간_7개가_표시_순서로_항상_모두_있고_합이_전체다() {
        RateFolderResponse folder = RateFolderService.toFolder(new BigDecimal("6.0"),
                Arrays.asList(best(1, "97.50", false), null));

        assertThat(folder.buckets()).extracting(RateBucketResponse::bucket).containsExactly(RateBucket.values());
        assertThat(folder.buckets().stream().mapToInt(RateBucketResponse::count).sum()).isEqualTo(folder.total());
        assertThat(bucket(folder, RateBucket.R90).count()).isZero();
    }

    @Test
    void 기록이_하나도_없으면_모두_미플레이다() {
        RateFolderResponse folder = RateFolderService.toFolder(new BigDecimal("6.0"), Arrays.asList(null, null, null));

        assertThat(folder.recorded()).isZero();
        assertThat(bucket(folder, RateBucket.UNPLAYED).count()).isEqualTo(3);
        assertThat(bucket(folder, RateBucket.UNPLAYED).exc()).isZero();
        assertThat(bucket(folder, RateBucket.UNPLAYED).fc()).isZero();
    }

    @Test
    void 레벨_폴더는_0점5_단위로_묶고_레벨_높은_폴더가_위다() {
        SongDifficulty a = chart("8.49");   // 8.00 폴더
        SongDifficulty b = chart("8.50");   // 8.50 폴더
        SongDifficulty c = chart("8.99");   // 8.50 폴더
        SongDifficulty d = chart("9.00");   // 9.00 폴더
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(charts);
        when(optionRecordRepository.findBestByUser(7L, NoteOption.SUPER_RANDOM_PLUS)).thenReturn(List.of(
                best(b.getId(), "96.00", false),
                best(d.getId(), "100.00", true)));

        RateFolderListResponse result = service.levelFolders(7L);

        assertThat(result.folders()).extracting(RateFolderResponse::key)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("9.00"), new BigDecimal("8.50"), new BigDecimal("8.00"));
        RateFolderResponse f850 = result.folders().get(1);
        assertThat(f850.total()).isEqualTo(2);
        assertThat(f850.recorded()).isEqualTo(1);
        assertThat(bucket(f850, RateBucket.R95).count()).isEqualTo(1);
        assertThat(bucket(f850, RateBucket.UNPLAYED).count()).isEqualTo(1);
        RateFolderResponse f900 = result.folders().get(0);
        assertThat(bucket(f900, RateBucket.R95).exc()).isEqualTo(1);
        assertThat(result.folders().get(2).recorded()).isZero();
        // 기록은 토큰의 사용자(7) 것만 조회한다
        verify(optionRecordRepository).findBestByUser(7L, NoteOption.SUPER_RANDOM_PLUS);
    }

    @Test
    void 채보가_없으면_폴더도_없다() {
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(List.of());
        when(optionRecordRepository.findBestByUser(7L, NoteOption.SUPER_RANDOM_PLUS)).thenReturn(List.of());

        assertThat(service.levelFolders(7L).folders()).isEmpty();
    }

    private DifficultyTableEntry entry(DifficultyTable table, SongDifficulty chart, String tier) {
        DifficultyTableEntry e = DifficultyTableEntry.create(table, chart);
        e.changeTier(tier == null ? null : new BigDecimal(tier), false, 1);
        return e;
    }

    @Test
    void 서열표_난이도는_기준_난이도별로_묶고_높은_난이도가_위며_미정은_뺀다() {
        DifficultyTable table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        SongDifficulty a = chart("8.00");
        SongDifficulty b = chart("8.10");
        SongDifficulty c = chart("9.00");
        SongDifficulty undecided = chart("9.10");
        when(difficultyTableRepository.findById(1L)).thenReturn(Optional.of(table));
        when(entryRepository.findAllForView(1L)).thenReturn(List.of(
                entry(table, a, "6.0"), entry(table, b, "6.0"), entry(table, c, "6.5"), entry(table, undecided, null)));
        when(optionRecordRepository.findBestByTable(7L, NoteOption.SUPER_RANDOM_PLUS, 1L)).thenReturn(List.of(
                best(a.getId(), "100.00", true),
                best(c.getId(), "85.00", false)));

        RateFolderListResponse result = service.tierFolders(7L, 1L);

        assertThat(result.folders()).extracting(RateFolderResponse::key)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("6.5"), new BigDecimal("6.0"));
        RateFolderResponse t65 = result.folders().get(0);
        assertThat(t65.total()).isEqualTo(1);
        assertThat(bucket(t65, RateBucket.R85).count()).isEqualTo(1);
        RateFolderResponse t60 = result.folders().get(1);
        assertThat(t60.total()).isEqualTo(2);
        assertThat(t60.recorded()).isEqualTo(1);
        assertThat(bucket(t60, RateBucket.R95).exc()).isEqualTo(1);
        assertThat(bucket(t60, RateBucket.UNPLAYED).count()).isEqualTo(1);
        // 기록은 토큰의 사용자(7) 것을, 서열표의 노트 옵션으로만 조회한다
        verify(optionRecordRepository).findBestByTable(7L, NoteOption.SUPER_RANDOM_PLUS, 1L);
    }

    @Test
    void 서열표가_없으면_예외다() {
        when(difficultyTableRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.tierFolders(7L, 99L)).isInstanceOf(ApiException.class);
    }

    /** tier 6.0 묶음: 레벨 8.00(a, 96%) / 8.10(b, 85%) / 8.20(c, 기록 없음). 6.5 묶음: d. 미정: e */
    private DifficultyTable stubTierTable() {
        DifficultyTable table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        SongDifficulty a = chart("8.00");
        SongDifficulty b = chart("8.10");
        SongDifficulty c = chart("8.20");
        SongDifficulty d = chart("9.00");
        SongDifficulty e = chart("9.10");
        when(difficultyTableRepository.findById(1L)).thenReturn(Optional.of(table));
        when(entryRepository.findAllForView(1L)).thenReturn(List.of(
                entry(table, a, "6.0"), entry(table, b, "6.0"), entry(table, c, "6.0"),
                entry(table, d, "6.5"), entry(table, e, null)));
        when(optionRecordRepository.findBestByTable(7L, NoteOption.SUPER_RANDOM_PLUS, 1L)).thenReturn(List.of(
                best(a.getId(), "96.00", false), best(b.getId(), "85.00", false), best(d.getId(), "100.00", true)));
        return table;
    }

    private static List<String> titles(PageResponse<TableEntryResponse> page) {
        return page.content().stream().map(TableEntryResponse::title).toList();
    }

    @Test
    void 서열표_폴더_목록은_기준_난이도와_구간으로_거른다() {
        stubTierTable();

        PageResponse<TableEntryResponse> r95 = service.tierCharts(7L, 1L, new BigDecimal("6.0"), RateBucket.R95,
                null, null, 0, 20);
        assertThat(titles(r95)).containsExactly("song1");
        assertThat(r95.content().get(0).mine().rate()).isEqualByComparingTo("96.00");

        assertThat(titles(service.tierCharts(7L, 1L, new BigDecimal("6.0"), RateBucket.UNPLAYED, null, null, 0, 20)))
                .containsExactly("song3");
        // 다른 난이도 묶음의 곡(d)이나 미정 곡(e)은 섞이지 않는다
        assertThat(service.tierCharts(7L, 1L, new BigDecimal("6.0"), null, null, null, 0, 20).totalElements()).isEqualTo(3);
        assertThat(titles(service.tierCharts(7L, 1L, new BigDecimal("6.5"), RateBucket.R95, null, null, 0, 20)))
                .containsExactly("song4");
    }

    @Test
    void 서열표_폴더_목록_정렬과_페이지() {
        stubTierTable();

        // 달성률 내림차순: 96(song1), 85(song2), 기록 없음(song3)
        PageResponse<TableEntryResponse> sorted = service.tierCharts(7L, 1L, new BigDecimal("6.0"), null, null,
                ChartSort.RATE_DESC, 0, 2);
        assertThat(titles(sorted)).containsExactly("song1", "song2");
        assertThat(sorted.totalElements()).isEqualTo(3);
        assertThat(sorted.totalPages()).isEqualTo(2);
        assertThat(titles(service.tierCharts(7L, 1L, new BigDecimal("6.0"), null, null, ChartSort.RATE_DESC, 1, 2)))
                .containsExactly("song3");
        // 기본 정렬은 레벨 높은 순
        assertThat(titles(service.tierCharts(7L, 1L, new BigDecimal("6.0"), null, null, null, 0, 20)))
                .containsExactly("song3", "song2", "song1");
    }

    @Test
    void 서열표_폴더_목록은_표가_없으면_예외다() {
        when(difficultyTableRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.tierCharts(7L, 99L, new BigDecimal("6.0"), null, null, null, 0, 20))
                .isInstanceOf(ApiException.class);
    }
}
