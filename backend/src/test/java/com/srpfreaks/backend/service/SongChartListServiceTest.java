package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.dto.ChartFolderListResponse;
import com.srpfreaks.backend.dto.ChartFolderResponse;
import com.srpfreaks.backend.dto.ChartRowResponse;
import com.srpfreaks.backend.dto.ChartSort;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.ChartPattern;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.entity.RateBucket;
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
import java.util.Optional;

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
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock DifficultyTableEntryRepository difficultyTableEntryRepository;

    SongChartListService service;
    final List<SongDifficulty> charts = new ArrayList<>();
    long nextId = 1;

    @BeforeEach
    void setUp() {
        service = new SongChartListService(songDifficultyRepository, optionRecordRepository, songRepository,
                difficultyTableRepository, difficultyTableEntryRepository);
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
    void 비로그인이면_기록을_조회하지_않고_곡_정보만_준다() {
        guitar("a", "9.00");
        stubCharts();

        var rows = service.charts(null, null, null, null, null, null, null, 0, 50).content();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).mine()).isNull();
        verify(optionRecordRepository, never()).findBestByUser(any(), any());
        // 폴더 목록도 같다
        service.folders(null);
        verify(optionRecordRepository, never()).findBestByUser(any(), any());
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
        chart("a", "ver-b", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("b", "ver-a", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("c", "ver-a", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("d", null, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        stubCharts();
        stubBests(7L);

        assertThat(service.folders(7L).versions()).containsExactly("ver-a", "ver-b");
    }

    @Test
    void 폴더_목록의_버전_선택지는_출시일_최신순이고_표에_없는_값은_맨_아래에_이름순으로_붙는다() {
        chart("a", "GITADORA Matixx", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("b", "zzz-신규", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("c", "GITADORA GALAXY WAVE DELTA", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("d", "XG3", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("e", "aaa-신규", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        stubCharts();
        stubBests(7L);

        // 표시 이름은 DB 값 그대로(Matixx 별칭 매칭이어도 이름을 바꾸지 않는다)
        assertThat(service.folders(7L).versions())
                .containsExactly("GITADORA GALAXY WAVE DELTA", "GITADORA Matixx", "XG3", "aaa-신규", "zzz-신규");
    }

    @Test
    void 폴더_목록에_필터를_걸면_맞는_채보만_폴더별로_센다() {
        chart("g-mas", "v1", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.60");
        chart("g-ext", "v1", InstrumentPart.GUITAR, DifficultyType.EXTREME, "9.70");
        chart("b-mas", "v1", InstrumentPart.BASS, DifficultyType.MASTER, "9.10");
        chart("e-ext", "v1", InstrumentPart.GUITAR, DifficultyType.EXTREME, "5.00");
        stubCharts();
        stubBests(7L);

        ChartFolderListResponse result = service.folders(7L, null, InstrumentPart.GUITAR, List.of(DifficultyType.EXTREME), null);

        // 9.50 폴더는 g-ext 하나, 9.00 폴더(b-mas는 Bass)는 맞는 채보가 없어 사라지고, 5.00 폴더(e-ext)는 남는다
        assertThat(result.folders()).extracting(f -> f.lo().toPlainString()).containsExactly("9.50", "5.00");
        assertThat(result.folders().get(0).total()).isEqualTo(1);
        assertThat(result.folders().get(0).subFolders()).hasSize(1);
        assertThat(result.totalCharts()).isEqualTo(2);
        // 버전 선택지는 필터와 상관없이 전체 기준
        assertThat(result.versions()).containsExactly("v1");
    }

    @Test
    void 폴더_목록의_버전_선택지는_필터를_걸어도_줄지_않는다() {
        chart("a", "ver-a", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart("b", "ver-b", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        stubCharts();
        stubBests(7L);

        ChartFolderListResponse result = service.folders(7L, null, null, null, "ver-b");

        assertThat(result.totalCharts()).isEqualTo(1);
        assertThat(result.versions()).containsExactly("ver-a", "ver-b");
    }

    @Test
    void 폴더_목록의_검색어는_곡_검색_결과로_거른다() {
        SongDifficulty hit = guitar("hit", "9.00");
        guitar("miss", "9.00");
        stubCharts();
        stubBests(7L);
        when(songRepository.searchIds(anyString(), anyString())).thenReturn(List.of(hit.getSong().getId()));

        ChartFolderListResponse result = service.folders(7L, "hit", null, null, null);

        assertThat(result.totalCharts()).isEqualTo(1);
        assertThat(result.folders().get(0).total()).isEqualTo(1);
    }

    @Test
    void 폴더_통계는_가장_높은_단계_하나만_세고_기록_없는_채보는_세지_않는다() {
        SongDifficulty exc = guitar("exc", "9.00");
        SongDifficulty fc = guitar("fc", "9.10");
        SongDifficulty ss = guitar("ss", "9.20");
        SongDifficulty s = guitar("s", "9.30");
        SongDifficulty a = guitar("a", "9.40");
        SongDifficulty sPlus = guitar("splus", "9.42");
        guitar("none", "9.45");
        stubCharts();
        stubBests(7L,
                new RecordBest(exc.getId(), new BigDecimal("100.00"), true),
                new RecordBest(fc.getId(), new BigDecimal("97.00"), true),
                new RecordBest(ss.getId(), new BigDecimal("96.00"), false),
                new RecordBest(s.getId(), new BigDecimal("85.00"), false),
                new RecordBest(a.getId(), new BigDecimal("75.00"), false),
                new RecordBest(sPlus.getId(), new BigDecimal("87.50"), false));

        ChartFolderResponse f = service.folders(7L).folders().get(0);

        assertThat(f.total()).isEqualTo(7);
        assertThat(f.recorded()).isEqualTo(6);
        assertThat(f.exc()).isEqualTo(1);
        assertThat(f.fc()).isEqualTo(1);
        assertThat(f.ss()).isEqualTo(1);
        assertThat(f.sPlus()).isEqualTo(1);   // 87.50은 S+ (D83)
        assertThat(f.s()).isEqualTo(1);
        assertThat(f.belowS()).isEqualTo(1);
        assertThat(f.exc() + f.fc() + f.ss() + f.sPlus() + f.s() + f.belowS()).isEqualTo(f.recorded());
        // (100 + 97 + 96 + 85 + 75 + 87.5) / 6 = 90.08, 기록 없는 채보를 0으로 넣으면 540.5 / 7 = 77.21
        assertThat(f.averageRecorded()).isEqualByComparingTo("90.08");
        assertThat(f.averageWithZero()).isEqualByComparingTo("77.21");
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

    private PageResponse<ChartRowResponse> callWithBucket(RateBucket bucket, ChartSort sort) {
        return service.charts(7L, null, null, null, null, null, null, bucket, sort, 0, 50);
    }

    private static RecordBest rate(SongDifficulty d, String rate) {
        return new RecordBest(d.getId(), new BigDecimal(rate), false);
    }

    @Test
    void 달성률_구간으로_거른다_경계와_미플레이_포함() {
        SongDifficulty a = guitar("a", "9.00");
        SongDifficulty b = guitar("b", "9.10");
        SongDifficulty c = guitar("c", "9.20");
        SongDifficulty d = guitar("d", "9.30");
        stubCharts();
        stubBests(7L, rate(a, "95.00"), rate(b, "94.99"), rate(c, "10.00"));

        assertThat(callWithBucket(RateBucket.R95, null).content()).extracting(ChartRowResponse::title).containsExactly("a");
        assertThat(callWithBucket(RateBucket.R90, null).content()).extracting(ChartRowResponse::title).containsExactly("b");
        assertThat(callWithBucket(RateBucket.BELOW, null).content()).extracting(ChartRowResponse::title).containsExactly("c");
        assertThat(callWithBucket(RateBucket.UNPLAYED, null).content()).extracting(ChartRowResponse::title).containsExactly("d");
    }

    @Test
    void 구간을_주지_않으면_전체가_나온다() {
        guitar("a", "9.00");
        guitar("b", "9.10");
        stubCharts();
        stubBests(7L);

        assertThat(callWithBucket(null, null).totalElements()).isEqualTo(2);
    }

    @Test
    void 달성률_내림차순은_기록_없는_채보를_맨_뒤에_둔다() {
        SongDifficulty a = guitar("a", "9.00");
        SongDifficulty b = guitar("b", "9.10");
        SongDifficulty c = guitar("c", "9.20");
        guitar("none", "9.90");
        stubCharts();
        stubBests(7L, rate(a, "80.00"), rate(b, "99.00"), rate(c, "99.00"));

        // 같은 달성률(b, c)은 레벨 높은 순(c, b), 기록 없는 곡은 레벨이 가장 높아도 맨 뒤
        assertThat(callWithBucket(null, ChartSort.RATE_DESC).content()).extracting(ChartRowResponse::title)
                .containsExactly("c", "b", "a", "none");
    }

    @Test
    void 달성률_오름차순도_기록_없는_채보를_맨_뒤에_둔다() {
        SongDifficulty a = guitar("a", "9.00");
        SongDifficulty b = guitar("b", "9.10");
        guitar("none", "9.90");
        stubCharts();
        stubBests(7L, rate(a, "80.00"), rate(b, "99.00"));

        assertThat(callWithBucket(null, ChartSort.RATE_ASC).content()).extracting(ChartRowResponse::title)
                .containsExactly("a", "b", "none");
    }

    @Test
    void 정렬을_주지_않으면_레벨_높은_순이다() {
        guitar("low", "9.00");
        guitar("high", "9.90");
        stubCharts();
        stubBests(7L);

        assertThat(callWithBucket(null, ChartSort.LEVEL).content()).extracting(ChartRowResponse::title)
                .containsExactly("high", "low");
    }

    // ---- 홈 진행도 속성 필터(D85) ----

    /** 채보 id별 속성을 가진 SRN+ 활성 서열표가 있는 것으로 꾸민다. 목록에 없는 채보는 서열표에 없는 채보다. */
    private void stubPatterns(Object... idAndPattern) {
        DifficultyTable table = DifficultyTable.create("SRN+", null, NoteOption.SUPER_RANDOM_PLUS);
        ReflectionTestUtils.setField(table, "id", 3L);
        when(difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE))
                .thenReturn(Optional.of(table));
        List<ChartPattern> rows = new ArrayList<>();
        for (int i = 0; i < idAndPattern.length; i += 2) {
            rows.add(new ChartPattern((Long) idAndPattern[i], (PatternType) idAndPattern[i + 1]));
        }
        when(difficultyTableEntryRepository.findChartPatterns(3L)).thenReturn(rows);
    }

    private ChartFolderListResponse foldersByPattern(String pattern) {
        return service.folders(7L, null, null, null, null, pattern);
    }

    @Test
    void 속성_필터는_그_속성의_채보만_폴더로_세고_칩_개수는_필터와_상관없이_같다() {
        SongDifficulty a = guitar("a", "9.00");   // 단일
        SongDifficulty b = guitar("b", "9.10");   // 단일
        SongDifficulty c = guitar("c", "9.20");   // 복합
        SongDifficulty d = guitar("d", "9.30");   // 이중
        SongDifficulty e = guitar("e", "9.40");   // 삼중
        stubCharts();
        stubBests(7L);
        stubPatterns(a.getId(), PatternType.SINGLE, b.getId(), PatternType.SINGLE, c.getId(), PatternType.COMPOUND,
                d.getId(), PatternType.DOUBLE, e.getId(), PatternType.TRIPLE);

        ChartFolderListResponse single = foldersByPattern("단일");
        assertThat(single.totalCharts()).isEqualTo(2);
        assertThat(single.folders().get(0).total()).isEqualTo(2);
        assertThat(foldersByPattern("복합").totalCharts()).isEqualTo(1);
        assertThat(foldersByPattern("이중").totalCharts()).isEqualTo(1);
        assertThat(foldersByPattern("삼중").totalCharts()).isEqualTo(1);
        // 속성을 안 주면 전체
        assertThat(foldersByPattern(null).totalCharts()).isEqualTo(5);
        assertThat(foldersByPattern("  ").totalCharts()).isEqualTo(5);
        // 칩 개수: 어떤 속성을 걸어도 같다
        assertThat(single.patternCounts()).containsExactly(
                java.util.Map.entry("단일", 2), java.util.Map.entry("복합", 1), java.util.Map.entry("이중", 1), java.util.Map.entry("삼중", 1));
        assertThat(foldersByPattern(null).patternCounts()).isEqualTo(single.patternCounts());
    }

    @Test
    void 속성이_없거나_레이팅_제외이거나_서열표에_없는_채보는_전체에만_들어간다() {
        SongDifficulty single = guitar("single", "9.00");
        SongDifficulty excluded = guitar("excluded", "9.10");   // 레이팅 제외
        SongDifficulty nullPattern = guitar("null", "9.20");    // 서열표에는 있으나 속성 없음
        SongDifficulty composite = guitar("composite", "9.30"); // 복합(단일): 칩에 없는 속성
        guitar("not-in-table", "9.40");                         // 서열표에 없음
        stubCharts();
        stubBests(7L);
        stubPatterns(single.getId(), PatternType.SINGLE, excluded.getId(), PatternType.EXCLUDED,
                nullPattern.getId(), null, composite.getId(), PatternType.COMPOSITE_SINGLE);

        assertThat(foldersByPattern(null).totalCharts()).isEqualTo(5);
        assertThat(foldersByPattern(null).patternCounts().values()).containsExactly(1, 0, 0, 0);
        for (String label : List.of("단일", "복합", "이중", "삼중")) {
            assertThat(foldersByPattern(label).totalCharts()).isEqualTo(label.equals("단일") ? 1 : 0);
        }
    }

    @Test
    void 속성_필터는_폴더_통계도_그_채보만으로_센다() {
        SongDifficulty played = guitar("played", "9.50");
        SongDifficulty other = guitar("other", "9.60");
        stubCharts();
        stubBests(7L, rate(played, "99.00"), rate(other, "99.00"));
        stubPatterns(played.getId(), PatternType.SINGLE, other.getId(), PatternType.COMPOUND);

        ChartFolderResponse folder = foldersByPattern("단일").folders().get(0);

        assertThat(folder.total()).isEqualTo(1);
        assertThat(folder.recorded()).isEqualTo(1);
        assertThat(folder.ss()).isEqualTo(1);
    }

    @Test
    void 서열표가_없으면_속성_필터는_빈_결과이고_전체는_그대로다() {
        guitar("a", "9.00");
        stubCharts();
        stubBests(7L);
        when(difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption.SUPER_RANDOM_PLUS, TableStatus.ACTIVE))
                .thenReturn(Optional.empty());

        assertThat(foldersByPattern("단일").totalCharts()).isZero();
        assertThat(foldersByPattern(null).totalCharts()).isEqualTo(1);
    }

    @Test
    void 잘못된_속성값은_400이다() {
        stubCharts();
        for (String bad : List.of("레이팅 제외", "복합(단일)", "SINGLE", "단일' OR '1'='1", "없는속성")) {
            assertThatThrownBy(() -> foldersByPattern(bad)).isInstanceOf(ApiException.class);
        }
    }
}
