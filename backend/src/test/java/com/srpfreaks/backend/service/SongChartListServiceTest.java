package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.dto.ChartFolderListResponse;
import com.srpfreaks.backend.dto.ChartFolderResponse;
import com.srpfreaks.backend.dto.ChartRowResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 곡 목록(DESIGN-UI 9장): 0.5 단위 폴더 경계, 칩/평균 통계, 필터, 검색, 페이지, 사용자 범위. */
@ExtendWith(MockitoExtension.class)
class SongChartListServiceTest {

    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock OptionRecordRepository optionRecordRepository;
    @Mock SongRepository songRepository;

    SongChartListService service;
    final List<SongDifficulty> charts = new ArrayList<>();
    long nextId = 1;

    @BeforeEach
    void setUp() {
        service = new SongChartListService(songDifficultyRepository, optionRecordRepository, songRepository);
    }

    private SongDifficulty chart(String title, String version, InstrumentPart part, DifficultyType type, String level) {
        Song song = Song.create(title, null, "test", null);
        song.changeMeta(version, null, null, null);
        ReflectionTestUtils.setField(song, "id", nextId);
        SongDifficulty d = SongDifficulty.create(song, part, type, new BigDecimal(level));
        ReflectionTestUtils.setField(d, "id", nextId);
        nextId++;
        charts.add(d);
        return d;
    }

    private SongDifficulty guitar(String title, String level) {
        return chart(title, "v1", InstrumentPart.GUITAR, DifficultyType.MASTER, level);
    }

    private void stubCharts() {
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(charts);
    }

    private void stubBests(Long userId, RecordBest... bests) {
        when(optionRecordRepository.findBestByUser(userId, NoteOption.SUPER_RANDOM_PLUS)).thenReturn(List.of(bests));
    }

    private PageResponse<ChartRowResponse> call(String q, BigDecimal folder, InstrumentPart part,
                                                List<DifficultyType> types, String version, int page, int size) {
        return service.charts(7L, q, folder, null, part, types, version, page, size);
    }

    private PageResponse<ChartRowResponse> callWithStep(BigDecimal folder, BigDecimal folderStep) {
        return service.charts(7L, null, folder, folderStep, null, null, null, 0, 50);
    }

    @Test
    void 폴더_경계는_0점5_단위로_내림한다() {
        assertThat(SongChartListService.folderLow(new BigDecimal("9.49"))).isEqualByComparingTo("9.00");
        assertThat(SongChartListService.folderLow(new BigDecimal("9.50"))).isEqualByComparingTo("9.50");
        assertThat(SongChartListService.folderLow(new BigDecimal("9.99"))).isEqualByComparingTo("9.50");
        assertThat(SongChartListService.folderLow(new BigDecimal("10.00"))).isEqualByComparingTo("10.00");
    }

    @Test
    void 하위_폴더_경계는_0점05_단위로_내림한다() {
        BigDecimal step = new BigDecimal("0.05");
        assertThat(SongChartListService.folderLow(new BigDecimal("9.04"), step)).isEqualByComparingTo("9.00");
        assertThat(SongChartListService.folderLow(new BigDecimal("9.05"), step)).isEqualByComparingTo("9.05");
        assertThat(SongChartListService.folderLow(new BigDecimal("9.09"), step)).isEqualByComparingTo("9.05");
        assertThat(SongChartListService.folderLow(new BigDecimal("9.10"), step)).isEqualByComparingTo("9.10");
        assertThat(SongChartListService.folderLow(new BigDecimal("9.49"), step)).isEqualByComparingTo("9.45");
    }

    @Test
    void 폴더_안에_0점05_하위_폴더가_레벨_높은_순으로_들어_있고_빈_하위_폴더는_없다() {
        guitar("a", "9.00");
        guitar("b", "9.04");
        guitar("c", "9.10");
        guitar("d", "9.49");
        stubCharts();
        stubBests(7L);

        ChartFolderResponse folder = service.folders(7L).folders().get(0);

        assertThat(folder.lo()).isEqualByComparingTo("9.00");
        assertThat(folder.subFolders()).extracting(f -> f.lo().toPlainString()).containsExactly("9.45", "9.10", "9.00");
        assertThat(folder.subFolders().get(2).hi()).isEqualByComparingTo("9.04");
        assertThat(folder.subFolders().get(2).total()).isEqualTo(2);
        // 하위 폴더 개수를 합치면 큰 폴더와 같다
        assertThat(folder.subFolders().stream().mapToInt(ChartFolderResponse::total).sum()).isEqualTo(folder.total());
        assertThat(folder.subFolders()).allSatisfy(f -> assertThat(f.subFolders()).isEmpty());
    }

    @Test
    void 하위_폴더도_같은_규칙으로_통계를_센다() {
        SongDifficulty exc = guitar("exc", "9.00");
        guitar("none", "9.03");
        SongDifficulty other = guitar("other", "9.10");
        stubCharts();
        stubBests(7L,
                new RecordBest(exc.getId(), new BigDecimal("100.00"), true),
                new RecordBest(other.getId(), new BigDecimal("80.00"), false));

        ChartFolderResponse sub = service.folders(7L).folders().get(0).subFolders().get(1);   // 9.00 ~ 9.04

        assertThat(sub.total()).isEqualTo(2);
        assertThat(sub.recorded()).isEqualTo(1);
        assertThat(sub.exc()).isEqualTo(1);
        assertThat(sub.s()).isZero();   // 9.10 채보의 S는 다른 하위 폴더에 센다
        assertThat(sub.averageRecorded()).isEqualByComparingTo("100.00");
        assertThat(sub.averageWithZero()).isEqualByComparingTo("50.00");
    }

    @Test
    void 폴더_단위를_0점05로_주면_하위_폴더_채보만_준다() {
        guitar("in1", "9.50");
        guitar("in2", "9.54");
        guitar("out", "9.55");
        stubCharts();
        stubBests(7L);

        // 같은 9.50이라도 단위에 따라 범위가 다르다: 큰 폴더는 9.50 ~ 9.99, 하위 폴더는 9.50 ~ 9.54
        assertThat(callWithStep(new BigDecimal("9.50"), new BigDecimal("0.05")).content())
                .extracting(ChartRowResponse::title).containsExactlyInAnyOrder("in1", "in2");
        assertThat(callWithStep(new BigDecimal("9.50"), null).content()).hasSize(3);
        assertThat(callWithStep(new BigDecimal("9.55"), new BigDecimal("0.05")).content())
                .extracting(ChartRowResponse::title).containsExactly("out");
    }

    @Test
    void 폴더_단위는_0점50과_0점05만_받는다() {
        assertThatThrownBy(() -> callWithStep(new BigDecimal("9.50"), new BigDecimal("0.10"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> callWithStep(new BigDecimal("9.50"), BigDecimal.ZERO)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> callWithStep(new BigDecimal("9.50"), new BigDecimal("-0.05"))).isInstanceOf(ApiException.class);
        // 0.05의 배수가 아니면 하위 폴더 시작값이 될 수 없다
        assertThatThrownBy(() -> callWithStep(new BigDecimal("9.52"), new BigDecimal("0.05"))).isInstanceOf(ApiException.class);
        // 0.05의 배수여도 큰 폴더(0.50) 시작값은 아니다 (기존 규칙 유지)
        assertThatThrownBy(() -> callWithStep(new BigDecimal("9.55"), null)).isInstanceOf(ApiException.class);
    }

    @Test
    void 폴더는_레벨_높은_순이고_채보가_없는_폴더는_만들지_않는다() {
        guitar("a", "9.49");
        guitar("b", "9.50");
        guitar("c", "9.99");
        guitar("d", "8.00");
        stubCharts();
        stubBests(7L);

        ChartFolderListResponse result = service.folders(7L);

        assertThat(result.folders()).extracting(f -> f.lo().toPlainString()).containsExactly("9.50", "9.00", "8.00");
        assertThat(result.folders().get(0).hi()).isEqualByComparingTo("9.99");
        assertThat(result.folders().get(0).total()).isEqualTo(2);
        assertThat(result.totalCharts()).isEqualTo(4);
        assertThat(result.totalSongs()).isEqualTo(4);
    }

    @Test
    void 곡_수는_곡_단위로_세고_채보_수는_채보_단위로_센다() {
        SongDifficulty a = guitar("a", "9.00");
        // 같은 곡의 다른 채보
        SongDifficulty b = SongDifficulty.create(a.getSong(), InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("8.00"));
        ReflectionTestUtils.setField(b, "id", 99L);
        charts.add(b);
        stubCharts();
        stubBests(7L);

        ChartFolderListResponse result = service.folders(7L);

        assertThat(result.totalSongs()).isEqualTo(1);
        assertThat(result.totalCharts()).isEqualTo(2);
    }

    @Test
    void 버전_목록은_빈_값을_빼고_중복_없이_정렬한다() {
        chart("a", "v2", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("b", "v1", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("c", "v1", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("d", null, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        stubCharts();
        stubBests(7L);

        assertThat(service.folders(7L).versions()).containsExactly("v1", "v2");
    }

    @Test
    void 폴더_통계는_가장_높은_단계_하나만_세고_기록_없는_채보는_세지_않는다() {
        SongDifficulty exc = guitar("exc", "9.00");
        SongDifficulty fc = guitar("fc", "9.10");
        SongDifficulty ss = guitar("ss", "9.20");
        SongDifficulty s = guitar("s", "9.30");
        SongDifficulty a = guitar("a", "9.40");
        guitar("none", "9.45");
        stubCharts();
        stubBests(7L,
                new RecordBest(exc.getId(), new BigDecimal("100.00"), true),
                new RecordBest(fc.getId(), new BigDecimal("97.00"), true),
                new RecordBest(ss.getId(), new BigDecimal("96.00"), false),
                new RecordBest(s.getId(), new BigDecimal("85.00"), false),
                new RecordBest(a.getId(), new BigDecimal("75.00"), false));

        ChartFolderResponse f = service.folders(7L).folders().get(0);

        assertThat(f.total()).isEqualTo(6);
        assertThat(f.recorded()).isEqualTo(5);
        assertThat(f.exc()).isEqualTo(1);
        assertThat(f.fc()).isEqualTo(1);
        assertThat(f.ss()).isEqualTo(1);
        assertThat(f.s()).isEqualTo(1);
        assertThat(f.belowS()).isEqualTo(1);
        // (100 + 97 + 96 + 85 + 75) / 5 = 90.60, 기록 없는 채보를 0으로 넣으면 453 / 6 = 75.50
        assertThat(f.averageRecorded()).isEqualByComparingTo("90.60");
        assertThat(f.averageWithZero()).isEqualByComparingTo("75.50");
    }

    @Test
    void 기록이_하나도_없으면_기록_평균은_null이고_0포함_평균은_0이다() {
        guitar("a", "9.00");
        stubCharts();
        stubBests(7L);

        ChartFolderResponse f = service.folders(7L).folders().get(0);

        assertThat(f.recorded()).isZero();
        assertThat(f.averageRecorded()).isNull();
        assertThat(f.averageWithZero()).isEqualByComparingTo("0.00");
    }

    @Test
    void 폴더를_지정하면_그_폴더_채보만_레벨_높은_순으로_준다() {
        guitar("b", "9.60");
        guitar("a", "9.99");
        guitar("other", "9.49");
        stubCharts();
        stubBests(7L);

        PageResponse<ChartRowResponse> page = call(null, new BigDecimal("9.50"), null, null, null, 0, 20);

        assertThat(page.content()).extracting(ChartRowResponse::title).containsExactly("a", "b");
        assertThat(page.totalElements()).isEqualTo(2);
    }

    @Test
    void 같은_레벨이면_곡명순으로_정렬한다() {
        guitar("나", "9.00");
        guitar("가", "9.00");
        stubCharts();
        stubBests(7L);

        assertThat(call(null, null, null, null, null, 0, 20).content())
                .extracting(ChartRowResponse::title).containsExactly("가", "나");
    }

    @Test
    void 파트_난이도_버전_필터는_함께_적용된다() {
        chart("g-mas", "v1", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("g-ext", "v1", InstrumentPart.GUITAR, DifficultyType.EXTREME, "9.00");
        chart("b-mas", "v1", InstrumentPart.BASS, DifficultyType.MASTER, "9.00");
        chart("g-mas-v2", "v2", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        stubCharts();
        stubBests(7L);

        assertThat(call(null, null, InstrumentPart.GUITAR, null, null, 0, 20).content()).hasSize(3);
        assertThat(call(null, null, null, List.of(DifficultyType.EXTREME), null, 0, 20).content())
                .extracting(ChartRowResponse::title).containsExactly("g-ext");
        assertThat(call(null, null, InstrumentPart.GUITAR, List.of(DifficultyType.MASTER), "v2", 0, 20).content())
                .extracting(ChartRowResponse::title).containsExactly("g-mas-v2");
    }

    @Test
    void 검색어는_곡_id_검색_결과로_채보를_거른다() {
        SongDifficulty hit = guitar("hit", "9.00");
        guitar("miss", "9.00");
        stubCharts();
        stubBests(7L);
        when(songRepository.searchIds(anyString(), anyString())).thenReturn(List.of(hit.getSong().getId()));

        PageResponse<ChartRowResponse> page = call("  hit ", null, null, null, null, 0, 20);

        assertThat(page.content()).extracting(ChartRowResponse::title).containsExactly("hit");
    }

    @Test
    void 검색어가_없으면_곡_검색_쿼리를_하지_않는다() {
        guitar("a", "9.00");
        stubCharts();
        stubBests(7L);

        call("   ", null, null, null, null, 0, 20);

        verify(songRepository, never()).searchIds(any(), any());
    }

    @Test
    void 내_기록이_있는_채보에만_mine이_붙는다() {
        SongDifficulty played = guitar("played", "9.10");
        guitar("unplayed", "9.00");
        stubCharts();
        stubBests(7L, new RecordBest(played.getId(), new BigDecimal("96.50"), false));

        List<ChartRowResponse> rows = call(null, null, null, null, null, 0, 20).content();

        assertThat(rows.get(0).mine().rate()).isEqualByComparingTo("96.50");
        assertThat(rows.get(0).mine().stage()).isEqualTo(AchievementStage.SS);
        assertThat(rows.get(1).mine()).isNull();
    }

    @Test
    void 내_기록은_토큰의_사용자_것만_조회한다() {
        guitar("a", "9.00");
        stubCharts();
        stubBests(7L);

        call(null, null, null, null, null, 0, 20);

        verify(optionRecordRepository).findBestByUser(eq(7L), eq(NoteOption.SUPER_RANDOM_PLUS));
        verify(optionRecordRepository, never()).findBestByUser(eq(8L), any());
    }

    @Test
    void 페이지_크기는_상한을_넘지_않고_마지막_페이지는_남은_만큼만_준다() {
        for (int i = 0; i < 55; i++) {
            guitar("song-%02d".formatted(i), "9.00");
        }
        stubCharts();
        stubBests(7L);

        PageResponse<ChartRowResponse> first = call(null, null, null, null, null, 0, 1000);
        PageResponse<ChartRowResponse> second = call(null, null, null, null, null, 1, 1000);
        PageResponse<ChartRowResponse> beyond = call(null, null, null, null, null, 9, 20);

        assertThat(first.size()).isEqualTo(SongChartListService.MAX_PAGE_SIZE);
        assertThat(first.content()).hasSize(50);
        assertThat(first.totalPages()).isEqualTo(2);
        assertThat(second.content()).hasSize(5);
        assertThat(beyond.content()).isEmpty();
        assertThat(beyond.totalElements()).isEqualTo(55);
    }

    @Test
    void 잘못된_입력은_400이다() {
        assertThatThrownBy(() -> call(null, new BigDecimal("9.30"), null, null, null, 0, 20)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> call(null, new BigDecimal("-0.50"), null, null, null, 0, 20)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> call("a".repeat(101), null, null, null, null, 0, 20)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> call(null, null, null, null, "v".repeat(31), 0, 20)).isInstanceOf(ApiException.class);
    }

    @Test
    void 맞는_채보가_없으면_빈_페이지다() {
        guitar("a", "9.00");   // MASTER 하나만 있다
        stubCharts();
        stubBests(7L);

        PageResponse<ChartRowResponse> page = call(null, null, null, List.of(DifficultyType.BASIC), null, 0, 20);

        assertThat(page.content()).isEmpty();
        assertThat(page.totalPages()).isZero();
    }
}
