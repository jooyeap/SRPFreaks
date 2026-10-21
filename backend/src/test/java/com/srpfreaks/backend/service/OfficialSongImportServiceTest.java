package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.OfficialSongCommitRequest;
import com.srpfreaks.backend.dto.OfficialSongCommitResponse;
import com.srpfreaks.backend.dto.OfficialSongImportRequest;
import com.srpfreaks.backend.dto.OfficialSongImportRequest.OfficialChartRow;
import com.srpfreaks.backend.dto.OfficialSongImportRequest.OfficialSong;
import com.srpfreaks.backend.dto.OfficialSongPreviewResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 공식 곡 목록 아티스트·레벨 갱신(D42): 비교 규칙, 새 곡 비생성, 선택 항목만 반영, 감사 로그. */
@ExtendWith(MockitoExtension.class)
class OfficialSongImportServiceTest {

    private static final Long ACTOR = 1L;

    @Mock SongRepository songRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    OfficialSongImportService service;
    User root;
    final List<SongDifficulty> charts = new ArrayList<>();
    final List<SongRepository.SongText> titles = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new OfficialSongImportService(songRepository, songDifficultyRepository, auditLogRepository, userRepository);
        root = User.create("sub-1", "root@example.com", null, Role.ROOT);
        lenient().when(userRepository.getReferenceById(ACTOR)).thenReturn(root);
        lenient().when(songRepository.findAllTitles()).thenReturn(titles);
        lenient().when(songRepository.findAllAliasTitles()).thenReturn(List.of());
        lenient().when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(charts);
    }

    private Song song(long id, String title, String artist) {
        Song song = Song.create(title, artist, "test", root);
        ReflectionTestUtils.setField(song, "id", id);
        titles.add(new SongRepository.SongText(id, title));
        return song;
    }

    private SongDifficulty chart(long id, Song song, InstrumentPart part, DifficultyType type, String level) {
        SongDifficulty d = SongDifficulty.create(song, part, type, new BigDecimal(level));
        ReflectionTestUtils.setField(d, "id", id);
        charts.add(d);
        return d;
    }

    private static OfficialSong official(String title, String artist, OfficialChartRow... rows) {
        return new OfficialSong(title, artist, List.of(rows));
    }

    private static OfficialChartRow row(String part, String bsc, String adv, String ext, String mas) {
        return new OfficialChartRow(part, List.of(bsc, adv, ext, mas));
    }

    private OfficialSongPreviewResponse preview(OfficialSong... songs) {
        return service.preview(new OfficialSongImportRequest(List.of(songs)));
    }

    // ---------------------------------------------------------------- 미리보기

    @Test
    void 아티스트가_비어_있는_곡은_채울_후보가_된다() {
        Song a = song(10, "Song A", null);
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");

        OfficialSongPreviewResponse result = preview(official("Song A", "  Artist X ", row("G", "-", "-", "-", "9.00")));

        assertThat(result.artistFills()).hasSize(1);
        assertThat(result.artistFills().get(0).officialArtist()).isEqualTo("Artist X");
        assertThat(result.levelChanges()).isEmpty();
        assertThat(result.matchedSongs()).isEqualTo(1);
        assertThat(result.unchangedSongs()).isZero();
    }

    @Test
    void 채보가_하나도_없는_곡도_아티스트는_채울_수_있다() {
        Song a = song(10, "Song A", null);
        when(songRepository.findAllById(any())).thenReturn(List.of(a));

        OfficialSongPreviewResponse result = preview(official("Song A", "Artist X"));

        assertThat(result.artistFills()).extracting("songId").containsExactly(10L);
    }

    @Test
    void 이미_아티스트가_있고_다르면_표시만_하고_같으면_아무것도_없다() {
        Song a = song(10, "Song A", "Old Name");
        Song b = song(11, "Song B", "Same　Artist");
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart(101, b, InstrumentPart.GUITAR, DifficultyType.MASTER, "8.00");

        OfficialSongPreviewResponse result = preview(
                official("Song A", "New Name", row("G", "-", "-", "-", "9.00")),
                official("Song B", "same artist", row("G", "-", "-", "-", "8.00")));

        assertThat(result.artistFills()).isEmpty();
        assertThat(result.artistMismatches()).hasSize(1);
        assertThat(result.artistMismatches().get(0).currentArtist()).isEqualTo("Old Name");
        assertThat(result.artistMismatches().get(0).officialArtist()).isEqualTo("New Name");
        assertThat(result.unchangedSongs()).isEqualTo(2); // 표시만 하는 "다름"은 바뀔 것으로 세지 않는다
    }

    @Test
    void 레벨이_다른_채보만_변경_후보가_되고_같은_레벨은_소수_자릿수가_달라도_같다() {
        Song a = song(10, "Song A", "X");
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart(101, a, InstrumentPart.GUITAR, DifficultyType.EXTREME, "8.50");
        chart(102, a, InstrumentPart.BASS, DifficultyType.MASTER, "7.00");

        OfficialSongPreviewResponse result = preview(official("Song A", "X",
                row("G", "-", "-", "8.5", "9.15"), row("B", "-", "-", "-", "7")));

        assertThat(result.levelChanges()).hasSize(1);
        OfficialSongPreviewResponse.LevelChange change = result.levelChanges().get(0);
        assertThat(change.songDifficultyId()).isEqualTo(100L);
        assertThat(change.part()).isEqualTo("GUITAR");
        assertThat(change.difficultyType()).isEqualTo("MASTER");
        assertThat(change.currentLevel()).isEqualByComparingTo("9.00");
        assertThat(change.officialLevel()).isEqualByComparingTo("9.15");
    }

    @Test
    void 마스터에_없는_채보는_만들지_않고_후보에도_올리지_않는다() {
        Song a = song(10, "Song A", "X");
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");

        OfficialSongPreviewResponse result = preview(official("Song A", "X", row("B", "5.0", "6.0", "7.0", "8.0")));

        assertThat(result.levelChanges()).isEmpty();
        assertThat(result.unchangedSongs()).isEqualTo(1);
    }

    @Test
    void 마스터에_없는_곡은_제외하고_곡명만_알린다() {
        song(10, "Song A", null);

        OfficialSongPreviewResponse result = preview(official("Unknown Song", "Y"));

        assertThat(result.unmatchedCount()).isEqualTo(1);
        assertThat(result.unmatchedTitles()).containsExactly("Unknown Song");
        assertThat(result.matchedSongs()).isZero();
        assertThat(result.artistFills()).isEmpty();
    }

    @Test
    void 같은_이름의_곡이_둘_이상이면_제외한다() {
        song(10, "Same Name", null);
        song(11, "SAME NAME", null);

        OfficialSongPreviewResponse result = preview(official("same name", "Y"));

        assertThat(result.unmatchedCount()).isEqualTo(1);
        assertThat(result.matchedSongs()).isZero();
    }

    @Test
    void 곡명은_전각_공백_대소문자를_무시하고_맞춘다() {
        Song a = song(10, "ＡＢＣ　Song", null);
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");

        OfficialSongPreviewResponse result = preview(official("abc song", "Y", row("G", "-", "-", "-", "9.00")));

        assertThat(result.matchedSongs()).isEqualTo(1);
        assertThat(result.unmatchedCount()).isZero();
        assertThat(result.artistFills()).extracting("songId").containsExactly(10L);
    }

    @Test
    void 기타와_베이스_줄이_나뉘어_와도_한_곡으로_합친다() {
        Song a = song(10, "Song A", "X");
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        chart(101, a, InstrumentPart.BASS, DifficultyType.MASTER, "7.00");

        OfficialSongPreviewResponse result = preview(
                official("Song A", "X", row("G", "-", "-", "-", "9.50")),
                official("Song A", null, row("B", "-", "-", "-", "7.50")));

        assertThat(result.readSongs()).isEqualTo(1);
        assertThat(result.levelChanges()).hasSize(2);
    }

    @Test
    void 읽을_수_없는_레벨은_비교에서_뺀다() {
        Song a = song(10, "Song A", "X");
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");

        OfficialSongPreviewResponse result = preview(official("Song A", "X", row("G", "abc", "10.00", "9.995", "-")));

        assertThat(result.levelChanges()).isEmpty();
    }

    @Test
    void 레벨_해석_경계값() {
        assertThat(OfficialSongImportService.parseLevel("0")).isEqualByComparingTo("0.00");
        assertThat(OfficialSongImportService.parseLevel("9.99")).isEqualByComparingTo("9.99");
        assertThat(OfficialSongImportService.parseLevel(" 9.80 ")).isEqualByComparingTo("9.80");
        assertThat(OfficialSongImportService.parseLevel("9.800")).isEqualByComparingTo("9.80");
        assertThat(OfficialSongImportService.parseLevel("10.00")).isNull();
        assertThat(OfficialSongImportService.parseLevel("-0.01")).isNull();
        assertThat(OfficialSongImportService.parseLevel("9.995")).isNull();
        assertThat(OfficialSongImportService.parseLevel("-")).isNull();
        assertThat(OfficialSongImportService.parseLevel("")).isNull();
        assertThat(OfficialSongImportService.parseLevel(null)).isNull();
        assertThat(OfficialSongImportService.parseLevel("abc")).isNull();
    }

    @Test
    void 파트_해석은_G_B만_받는다() {
        assertThat(OfficialSongImportService.partOf("g")).isEqualTo(InstrumentPart.GUITAR);
        assertThat(OfficialSongImportService.partOf(" B ")).isEqualTo(InstrumentPart.BASS);
        assertThat(OfficialSongImportService.partOf("D")).isNull();
        assertThat(OfficialSongImportService.partOf(null)).isNull();
    }

    // ---------------------------------------------------------------- 반영

    private OfficialSongCommitRequest commitRequest(List<Long> songIds, List<Long> chartIds, OfficialSong... songs) {
        return new OfficialSongCommitRequest(List.of(songs), songIds, chartIds);
    }

    @Test
    void 고른_항목만_반영하고_감사_로그를_한_번_남긴다() {
        Song a = song(10, "Song A", null);
        Song b = song(11, "Song B", null);
        SongDifficulty ca = chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");
        SongDifficulty cb = chart(101, b, InstrumentPart.GUITAR, DifficultyType.MASTER, "8.00");

        OfficialSongCommitResponse result = service.commit(ACTOR, commitRequest(List.of(10L), List.of(100L),
                official("Song A", "Artist A", row("G", "-", "-", "-", "9.50")),
                official("Song B", "Artist B", row("G", "-", "-", "-", "8.50"))));

        assertThat(result.artistFilled()).isEqualTo(1);
        assertThat(result.levelChanged()).isEqualTo(1);
        assertThat(result.skipped()).isZero();
        assertThat(a.getArtist()).isEqualTo("Artist A");
        assertThat(b.getArtist()).isNull(); // 고르지 않은 곡은 그대로
        assertThat(ca.getLevel()).isEqualByComparingTo("9.50");
        assertThat(cb.getLevel()).isEqualByComparingTo("8.00");

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLog log = captor.getValue();
        assertThat(log.getAction()).isEqualTo("SONG_OFFICIAL_IMPORT");
        assertThat(log.getDetail()).containsEntry("artistFilled", 1).containsEntry("levelChanged", 1);
        // 곡명·아티스트 같은 값은 감사 로그에 넣지 않는다
        assertThat(log.getDetail().toString()).doesNotContain("Artist A", "Song A");
    }

    @Test
    void 지금은_차이가_아닌_id를_보내면_건너뛰고_개수로_알린다() {
        Song a = song(10, "Song A", "Already");
        SongDifficulty ca = chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");

        OfficialSongCommitResponse result = service.commit(ACTOR, commitRequest(List.of(10L, 999L), List.of(100L, 888L),
                official("Song A", "Other", row("G", "-", "-", "-", "9.00"))));

        assertThat(result.artistFilled()).isZero();
        assertThat(result.levelChanged()).isZero();
        assertThat(result.skipped()).isEqualTo(4);
        assertThat(a.getArtist()).isEqualTo("Already"); // 이미 있는 아티스트는 덮어쓰지 않는다
        assertThat(ca.getLevel()).isEqualByComparingTo("9.00");
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 아무것도_고르지_않으면_감사_로그도_남기지_않는다() {
        Song a = song(10, "Song A", null);
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");

        OfficialSongCommitResponse result = service.commit(ACTOR, commitRequest(List.of(), List.of(),
                official("Song A", "Artist A", row("G", "-", "-", "-", "9.50"))));

        assertThat(result).isEqualTo(new OfficialSongCommitResponse(0, 0, 0));
        assertThat(a.getArtist()).isNull();
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 반영해도_새_곡과_새_채보는_만들지_않는다() {
        Song a = song(10, "Song A", null);
        chart(100, a, InstrumentPart.GUITAR, DifficultyType.MASTER, "9.00");

        service.commit(ACTOR, commitRequest(List.of(10L), List.of(),
                official("Song A", "Artist A", row("B", "5.0", "6.0", "7.0", "8.0")),
                official("New Song", "Artist N", row("G", "5.0", "6.0", "7.0", "8.0"))));

        verify(songRepository, never()).save(any());
        verify(songDifficultyRepository, never()).save(any());
        verify(songDifficultyRepository, never()).saveAll(any());
    }
}
