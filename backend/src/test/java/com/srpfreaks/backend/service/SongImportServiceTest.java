package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SongImportResponse;
import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Recommend;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.entity.TitleKind;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/** CSV 일괄 등록: 미리보기는 쓰지 않는다 / 저장은 멱등 업서트 / 오류가 있으면 저장하지 않는다. */
@ExtendWith(MockitoExtension.class)
class SongImportServiceTest {

    private static final String HEADER = "title,part,difficulty,level,added_version,source\n";
    private static final Long ACTOR = 7L;

    @Mock SongRepository songRepository;
    @Mock SongTitleRepository songTitleRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock DifficultyTableEntryRepository difficultyTableEntryRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    SongImportService service;
    final List<Song> songs = new ArrayList<>();
    final List<SongTitle> titles = new ArrayList<>();
    final List<SongDifficulty> difficulties = new ArrayList<>();
    final List<DifficultyTableEntry> entries = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new SongImportService(songRepository, songTitleRepository, songDifficultyRepository,
                difficultyTableRepository, difficultyTableEntryRepository, auditLogRepository, userRepository);
        lenient().when(songRepository.findAll()).thenReturn(songs);
        lenient().when(songTitleRepository.findAll()).thenReturn(titles);
        lenient().when(songDifficultyRepository.findBySongIdIn(any())).thenReturn(difficulties);
        lenient().when(difficultyTableEntryRepository.findAllByDifficultyTableId(any())).thenReturn(entries);
        lenient().when(songRepository.save(any(Song.class))).thenAnswer(i -> {
            Song s = i.getArgument(0);
            ReflectionTestUtils.setField(s, "id", 100L + songs.size());
            return s;
        });
    }

    private Song existingSong(long id, String title) {
        Song song = Song.create(title, null, "old", null);
        ReflectionTestUtils.setField(song, "id", id);
        songs.add(song);
        return song;
    }

    private SongDifficulty existingChart(Song song, InstrumentPart part, DifficultyType type, String level) {
        SongDifficulty d = SongDifficulty.create(song, part, type, new BigDecimal(level));
        difficulties.add(d);
        return d;
    }

    private SongImportResponse run(String body, boolean confirm) {
        return service.importCsv(ACTOR, (HEADER + body).getBytes(StandardCharsets.UTF_8), confirm);
    }

    @Test
    void 미리보기는_개수만_계산하고_아무것도_저장하지_않는다() {
        SongImportResponse r = run("Saiph,GUITAR,MASTER,9.99,V4,s\nSaiph,BASS,MASTER,9.5,V4,s\nStargazer,GUITAR,MASTER,9,V5,s\n", false);

        assertThat(r.applied()).isFalse();
        assertThat(r.totalRows()).isEqualTo(3);
        assertThat(r.newSongs()).isEqualTo(2);
        assertThat(r.newDifficulties()).isEqualTo(3);
        verify(songRepository, never()).save(any());
        verify(songDifficultyRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 저장하면_새_곡과_채보를_만들고_감사_로그를_남긴다() {
        SongImportResponse r = run("Saiph,GUITAR,MASTER,9.99,V4,sheet-v1.1\nSaiph,BASS,MASTER,9.5,V4,sheet-v1.1\n", true);

        assertThat(r.applied()).isTrue();
        ArgumentCaptor<Song> songCaptor = ArgumentCaptor.forClass(Song.class);
        verify(songRepository).save(songCaptor.capture());
        assertThat(songCaptor.getValue().getTitle()).isEqualTo("Saiph");
        assertThat(songCaptor.getValue().getAddedVersion()).isEqualTo("V4");
        assertThat(songCaptor.getValue().getSource()).isEqualTo("sheet-v1.1");
        verify(songDifficultyRepository, times(2)).save(any(SongDifficulty.class));
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("SONG_IMPORT");
    }

    @Test
    void 같은_채보는_그대로_두고_레벨이_다르면_변경_후보로_알리고_갱신한다() {
        Song saiph = existingSong(1L, "Saiph");
        SongDifficulty same = existingChart(saiph, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.99");
        SongDifficulty changed = existingChart(saiph, InstrumentPart.BASS, DifficultyType.MASTER, "9.50");

        SongImportResponse r = run("Saiph,GUITAR,MASTER,9.99,,\nSaiph,BASS,MASTER,9.60,,\n", true);

        assertThat(r.newSongs()).isZero();
        assertThat(r.newDifficulties()).isZero();
        assertThat(r.unchangedDifficulties()).isEqualTo(1);
        assertThat(r.levelChangeCount()).isEqualTo(1);
        assertThat(r.levelChanges().get(0).before()).isEqualByComparingTo("9.50");
        assertThat(r.levelChanges().get(0).after()).isEqualByComparingTo("9.60");
        assertThat(same.getLevel()).isEqualByComparingTo("9.99");
        assertThat(changed.getLevel()).isEqualByComparingTo("9.60");
        verify(songRepository, never()).save(any());
    }

    @Test
    void 같은_파일을_다시_올려도_결과가_같다() {
        Song saiph = existingSong(1L, "Saiph");
        existingChart(saiph, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.99");
        saiph.changeMeta("V4", null, 100, 200);

        SongImportResponse r = run("Saiph,GUITAR,MASTER,9.99,V4,s\n", true);

        assertThat(r.newSongs() + r.updatedSongs() + r.newDifficulties() + r.levelChangeCount()).isZero();
        assertThat(r.unchangedDifficulties()).isEqualTo(1);
    }

    @Test
    void 곡명은_정규화해서_찾는다_전각_공백_대소문자() {
        existingSong(1L, "Necro Fantasia");

        SongImportResponse r = run("ＮＥＣＲＯ  fantasia,GUITAR,MASTER,9,,\n", false);

        assertThat(r.newSongs()).isZero();
        assertThat(r.newDifficulties()).isEqualTo(1);
    }

    @Test
    void 별칭_표기로도_기존_곡을_찾는다() {
        Song song = existingSong(1L, "ネクロファンタジア");
        titles.add(SongTitle.create(song, TitleKind.ROMAJI, "Necro Fantasia"));
        ReflectionTestUtils.setField(titles.get(0), "song", song);

        SongImportResponse r = run("necro fantasia,GUITAR,MASTER,9,,\n", false);

        assertThat(r.newSongs()).isZero();
    }

    @Test
    void 기존_곡의_초출_버전만_바꾸고_BPM_같은_메타데이터는_지우지_않는다() {
        Song song = existingSong(1L, "Saiph");
        song.changeMeta("V3", "S", 120, 180);

        SongImportResponse r = run("Saiph,GUITAR,MASTER,9,V4,\n", true);

        assertThat(r.updatedSongs()).isEqualTo(1);
        assertThat(song.getAddedVersion()).isEqualTo("V4");
        assertThat(song.getTitleFolder()).isEqualTo("S");
        assertThat(song.getBpmMin()).isEqualTo(120);
        assertThat(song.getBpmMax()).isEqualTo(180);
    }

    @Test
    void 삭제된_곡과_삭제된_채보는_되살리지_않고_건너뛴다() {
        Song deletedSong = existingSong(1L, "Deleted Song");
        deletedSong.delete();
        Song live = existingSong(2L, "Live Song");
        SongDifficulty deletedChart = existingChart(live, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        deletedChart.delete();

        SongImportResponse r = run("Deleted Song,GUITAR,MASTER,9,,\nLive Song,GUITAR,MASTER,9.5,,\n", true);

        assertThat(r.skippedDeleted()).isEqualTo(2);
        assertThat(r.newSongs()).isZero();
        assertThat(deletedSong.isDeleted()).isTrue();
        assertThat(deletedChart.isDeleted()).isTrue();
        assertThat(deletedChart.getLevel()).isEqualByComparingTo("9.00");
    }

    @Test
    void 오류_행이_있으면_저장을_요청해도_아무것도_저장하지_않는다() {
        SongImportResponse r = run("Good,GUITAR,MASTER,9,,\nBad,DRUM,MASTER,9,,\n", true);

        assertThat(r.applied()).isFalse();
        assertThat(r.errorCount()).isEqualTo(1);
        assertThat(r.errors().get(0).line()).isEqualTo(3);
        verify(songRepository, never()).save(any());
        verify(songDifficultyRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 파일_안의_중복_채보는_오류다() {
        SongImportResponse r = run("Saiph,GUITAR,MASTER,9,,\n saiph ,GUITAR,MASTER,9.5,,\n", true);

        assertThat(r.errorCount()).isEqualTo(1);
        assertThat(r.errors().get(0).line()).isEqualTo(3);
        assertThat(r.applied()).isFalse();
    }

    @Test
    void 같은_이름으로_곡이_둘_이상_찾아지면_오류다() {
        existingSong(1L, "Same Name");
        existingSong(2L, "same  name");

        SongImportResponse r = run("Same Name,GUITAR,MASTER,9,,\n", true);

        assertThat(r.errorCount()).isEqualTo(1);
        assertThat(r.applied()).isFalse();
    }

    @Test
    void 같은_곡의_초출_버전이_행마다_다르면_오류다() {
        SongImportResponse r = run("Saiph,GUITAR,MASTER,9,V3,\nSaiph,BASS,MASTER,9,V4,\n", true);

        assertThat(r.errorCount()).isEqualTo(2);
        assertThat(r.applied()).isFalse();
    }

    // ---------------------------------------------------------------- 서열표 모드

    private static final String TABLE_HEADER = "title,part,difficulty,level,added_version,tier_label,tier_uncertain,"
            + "recommend,recommend_uncertain,pattern_type,pattern_uncertain,source\n";

    private DifficultyTable table() {
        DifficultyTable table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        ReflectionTestUtils.setField(table, "id", 5L);
        lenient().when(difficultyTableRepository.findById(5L)).thenReturn(java.util.Optional.of(table));
        return table;
    }

    private SongImportResponse runTable(String body, boolean confirm) {
        return service.importTable(ACTOR, 5L, (TABLE_HEADER + body).getBytes(StandardCharsets.UTF_8), confirm);
    }

    private DifficultyTableEntry existingEntry(DifficultyTable table, SongDifficulty chart, String tier, Recommend rec,
                                               PatternType pattern) {
        ReflectionTestUtils.setField(chart, "id", 50L + entries.size());
        DifficultyTableEntry entry = DifficultyTableEntry.create(table, chart);
        entry.changeTier(new BigDecimal(tier), false, 3);
        entry.changeRecommend(rec, false);
        entry.changePattern(pattern, false);
        entries.add(entry);
        return entry;
    }

    @Test
    void 서열표_저장은_새_항목을_만들고_표_버전을_올린다() {
        DifficultyTable table = table();

        SongImportResponse r = runTable("Saiph,GUITAR,MASTER,9.99,V4,6.1,,중,,단일,,sheet\nStargazer,BASS,MASTER,9,V5,,1,,,레이팅 제외,,sheet\n", true);

        assertThat(r.applied()).isTrue();
        assertThat(r.newEntries()).isEqualTo(2);
        ArgumentCaptor<DifficultyTableEntry> captor = ArgumentCaptor.forClass(DifficultyTableEntry.class);
        verify(difficultyTableEntryRepository, times(2)).save(captor.capture());
        DifficultyTableEntry first = captor.getAllValues().get(0);
        assertThat(first.getTierLabel()).isEqualByComparingTo("6.1");
        assertThat(first.getRecommend()).isEqualTo(Recommend.MIDDLE);
        assertThat(first.getPatternType()).isEqualTo(PatternType.SINGLE);
        DifficultyTableEntry second = captor.getAllValues().get(1);
        assertThat(second.getTierLabel()).isNull();           // 기준 난이도 "?"만 있는 채보
        assertThat(second.isTierUncertain()).isTrue();
        assertThat(second.getPatternType()).isEqualTo(PatternType.EXCLUDED);
        assertThat(table.getRevision()).isEqualTo(2);
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("DIFFICULTY_TABLE_IMPORT");
        assertThat(audit.getValue().getTargetId()).isEqualTo("5");
    }

    @Test
    void 서열표_미리보기는_항목을_저장하지도_기존_항목을_바꾸지도_않는다() {
        DifficultyTable table = table();
        Song saiph = existingSong(1L, "Saiph");
        SongDifficulty chart = existingChart(saiph, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.99");
        DifficultyTableEntry entry = existingEntry(table, chart, "6.0", Recommend.LOW, PatternType.DOUBLE);

        SongImportResponse r = runTable("Saiph,GUITAR,MASTER,9.99,,6.5,,상,,단일,,\n", false);

        assertThat(r.applied()).isFalse();
        assertThat(r.updatedEntries()).isEqualTo(1);
        verify(difficultyTableEntryRepository, never()).save(any());
        // 미리보기에서 영속 엔티티를 바꾸면 트랜잭션이 끝날 때 몰래 저장된다
        assertThat(entry.getTierLabel()).isEqualByComparingTo("6.0");
        assertThat(entry.getRecommend()).isEqualTo(Recommend.LOW);
        assertThat(entry.getPatternType()).isEqualTo(PatternType.DOUBLE);
        assertThat(table.getRevision()).isEqualTo(1);
    }

    @Test
    void 서열표_저장은_바뀐_항목만_갱신하고_표시_순서_tier_order는_유지한다() {
        DifficultyTable table = table();
        Song saiph = existingSong(1L, "Saiph");
        SongDifficulty changedChart = existingChart(saiph, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.99");
        SongDifficulty sameChart = existingChart(saiph, InstrumentPart.BASS, DifficultyType.MASTER, "9.00");
        DifficultyTableEntry changed = existingEntry(table, changedChart, "6.0", Recommend.LOW, PatternType.DOUBLE);
        existingEntry(table, sameChart, "5.5", Recommend.HIGH, PatternType.SINGLE);

        SongImportResponse r = runTable("Saiph,GUITAR,MASTER,9.99,,6.5,,상,,단일,,\nSaiph,BASS,MASTER,9,,5.5,,상,,단일,,\n", true);

        assertThat(r.updatedEntries()).isEqualTo(1);
        assertThat(r.unchangedEntries()).isEqualTo(1);
        assertThat(r.newEntries()).isZero();
        assertThat(changed.getTierLabel()).isEqualByComparingTo("6.5");
        assertThat(changed.getRecommend()).isEqualTo(Recommend.HIGH);
        assertThat(changed.getPatternType()).isEqualTo(PatternType.SINGLE);
        assertThat(changed.getTierOrder()).isEqualTo(3);
        assertThat(table.getRevision()).isEqualTo(2);
    }

    @Test
    void 서열표_값을_비우면_미정으로_반영된다() {
        DifficultyTable table = table();
        Song saiph = existingSong(1L, "Saiph");
        SongDifficulty chart = existingChart(saiph, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.99");
        DifficultyTableEntry entry = existingEntry(table, chart, "6.0", Recommend.LOW, PatternType.DOUBLE);

        runTable("Saiph,GUITAR,MASTER,9.99,,,,,,,,\n", true);

        assertThat(entry.getTierLabel()).isNull();
        assertThat(entry.getRecommend()).isNull();
        assertThat(entry.getPatternType()).isNull();
    }

    @Test
    void 서열표_열의_잘못된_값은_오류이고_저장하지_않는다() {
        table();

        SongImportResponse r = runTable("A,GUITAR,MASTER,9,,6.55,,최상,,없음,,\nB,GUITAR,MASTER,9,,6,x,,,,,\n", true);

        assertThat(r.applied()).isFalse();
        assertThat(r.errorCount()).isEqualTo(4);   // 2행: 기준 난이도·추천도·속성, 3행: 불확실 표시
        verify(difficultyTableEntryRepository, never()).save(any());
        verify(songRepository, never()).save(any());
    }

    @Test
    void 없는_서열표는_404다() {
        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> service.importTable(ACTOR, 99L, (TABLE_HEADER).getBytes(StandardCharsets.UTF_8), false))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    void 곡만_올릴_때는_서열표_열을_검증하지도_반영하지도_않는다() {
        SongImportResponse r = service.importCsv(ACTOR,
                (TABLE_HEADER + "A,GUITAR,MASTER,9,,아무거나,,최상,,없음,,\n").getBytes(StandardCharsets.UTF_8), true);

        assertThat(r.errorCount()).isZero();
        assertThat(r.newEntries()).isZero();
        verify(difficultyTableEntryRepository, never()).save(any());
    }
}
