package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SongInfoCommitRequest;
import com.srpfreaks.backend.dto.SongInfoCommitRequest.Selection;
import com.srpfreaks.backend.dto.SongInfoCommitResponse;
import com.srpfreaks.backend.dto.SongInfoImportRequest;
import com.srpfreaks.backend.dto.SongInfoImportRequest.InfoRow;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse.Row;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse.Status;
import com.srpfreaks.backend.dto.SongJacketMatchResponse;
import com.srpfreaks.backend.dto.SongJacketMatchResponse.Match;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * 곡 정보(아티스트·BPM) 가져오기 (D90): 상태 판정(새로 채움/덮어쓰기/변경 없음/값 없음), 값 검증·정규화,
 * 고른 항목만 저장, 감사 로그(값 없이 개수·id만). 곡명 매칭은 재킷 가져오기(D54)의 {@link SongJacketAdminService#match}를 쓰므로 여기서는 가짜로 둔다.
 */
@ExtendWith(MockitoExtension.class)
class SongInfoImportServiceTest {

    private static final Long ACTOR = 1L;

    @Mock SongJacketAdminService jacketService;
    @Mock SongRepository songRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    SongInfoImportService service;
    User root;
    final List<Song> songs = new ArrayList<>();
    final List<Match> matches = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new SongInfoImportService(jacketService, songRepository, auditLogRepository, userRepository);
        root = User.create("sub-1", "root@example.com", null, Role.ROOT);
        lenient().when(userRepository.getReferenceById(ACTOR)).thenReturn(root);
        lenient().when(jacketService.match(any())).thenAnswer(inv -> new SongJacketMatchResponse(List.copyOf(matches), 0, List.of()));
        lenient().when(songRepository.findAllById(any())).thenAnswer(inv -> songs);
    }

    /** 마스터에 있는 곡(곡명이 공식 곡명과 같게 맞은 것으로 본다). */
    private Song song(long id, String title, String artist, Integer bpmMin, Integer bpmMax) {
        Song song = Song.create(title, artist, "test", root);
        ReflectionTestUtils.setField(song, "id", id);
        if (bpmMin != null) {
            song.changeBpm(bpmMin, bpmMax);
        }
        songs.add(song);
        matches.add(new Match(title, id, title, false));
        return song;
    }

    private static InfoRow row(String title, String artist, String bpm) {
        return new InfoRow(title, artist, bpm);
    }

    private SongInfoPreviewResponse preview(InfoRow... rows) {
        return service.preview(new SongInfoImportRequest(List.of(rows)));
    }

    private SongInfoCommitResponse commit(List<Selection> selections, InfoRow... rows) {
        return service.commit(ACTOR, new SongInfoCommitRequest(List.of(rows), selections));
    }

    // ---------------------------------------------------------------- 상태 판정

    @Test
    void 비어_있으면_새로_채움_같으면_변경_없음_다르면_덮어쓰기_공식에_없으면_값_없음() {
        song(1L, "Empty", null, null, null);
        song(2L, "Same", "Ryu", 172, 172);
        song(3L, "Different", "Ryu", 195, 195);
        song(4L, "NoOfficial", null, null, null);

        SongInfoPreviewResponse result = preview(
                row("Empty", "Tsukasa Komori", "180"),
                row("Same", "RYU", "172"),
                row("Different", "Ryu feat. Kobaryo", "195-200"),
                row("NoOfficial", "", ""));

        Row empty = result.rows().get(0);
        assertThat(empty.artist().status()).isEqualTo(Status.FILL);
        assertThat(empty.bpm().status()).isEqualTo(Status.FILL);
        assertThat(empty.bpm().officialMin()).isEqualTo(180);
        assertThat(empty.bpm().officialMax()).isEqualTo(180);

        Row same = result.rows().get(1);
        assertThat(same.artist().status()).isEqualTo(Status.UNCHANGED); // 대소문자만 다른 표기는 같은 것
        assertThat(same.bpm().status()).isEqualTo(Status.UNCHANGED);

        Row different = result.rows().get(2);
        assertThat(different.artist().status()).isEqualTo(Status.OVERWRITE);
        assertThat(different.artist().current()).isEqualTo("Ryu");
        assertThat(different.bpm().status()).isEqualTo(Status.OVERWRITE);
        assertThat(different.bpm().officialMin()).isEqualTo(195);
        assertThat(different.bpm().officialMax()).isEqualTo(200);

        Row none = result.rows().get(3);
        assertThat(none.artist().status()).isEqualTo(Status.NONE);
        assertThat(none.bpm().status()).isEqualTo(Status.NONE);
    }

    @Test
    void BPM이_공식_화면에_없으면_아티스트만_읽고_BPM은_값_없음이다() {
        song(1L, "Song", null, null, null);

        Row r = preview(row("Song", "Artist", null)).rows().get(0);

        assertThat(r.artist().status()).isEqualTo(Status.FILL);
        assertThat(r.bpm().status()).isEqualTo(Status.NONE);
    }

    @Test
    void 마스터에_없는_곡은_줄로_돌려주지_않고_제외_개수로_센다() {
        song(1L, "Known", null, null, null);

        SongInfoPreviewResponse result = preview(row("Known", "A", "150"), row("Unknown", "B", "160"));

        assertThat(result.readSongs()).isEqualTo(2);
        assertThat(result.matchedSongs()).isEqualTo(1);
        assertThat(result.unmatchedCount()).isEqualTo(1);
        assertThat(result.rows()).extracting(Row::songTitle).containsExactly("Known");
    }

    // ---------------------------------------------------------------- 값 검증·정규화

    @Test
    void BPM_글자를_최소_최대로_읽는다() {
        assertThat(SongInfoImportService.parseBpm("172")).containsExactly(172, 172);
        assertThat(SongInfoImportService.parseBpm(" 120-180 ")).containsExactly(120, 180);
        assertThat(SongInfoImportService.parseBpm("120 ~ 180")).containsExactly(120, 180);
        assertThat(SongInfoImportService.parseBpm("120〜180")).containsExactly(120, 180);
        assertThat(SongInfoImportService.parseBpm("１７２")).containsExactly(172, 172); // 전각 숫자는 NFKC로 맞춘다
        assertThat(SongInfoImportService.parseBpm("1")).containsExactly(1, 1);
        assertThat(SongInfoImportService.parseBpm("2000")).containsExactly(2000, 2000);
    }

    @Test
    void BPM이_정수_범위_밖이거나_읽을_수_없으면_값_없음이다() {
        assertThat(SongInfoImportService.parseBpm(null)).isNull();
        assertThat(SongInfoImportService.parseBpm("")).isNull();
        assertThat(SongInfoImportService.parseBpm("0")).isNull();
        assertThat(SongInfoImportService.parseBpm("2001")).isNull();
        assertThat(SongInfoImportService.parseBpm("180-120")).isNull(); // 최소가 최대보다 큼
        assertThat(SongInfoImportService.parseBpm("172.5")).isNull();
        assertThat(SongInfoImportService.parseBpm("-")).isNull();
        assertThat(SongInfoImportService.parseBpm("BPM 172")).isNull();
        assertThat(SongInfoImportService.parseBpm("12345")).isNull();
    }

    @Test
    void 아티스트는_NFKC로_맞추고_줄바꿈을_없애며_너무_길면_값_없음이다() {
        assertThat(SongInfoImportService.normalizeArtist("Ｒｙｕ☆")).isEqualTo("Ryu☆");
        assertThat(SongInfoImportService.normalizeArtist("Ryu\r\nfeat.  Kobaryo\n")).isEqualTo("Ryu feat. Kobaryo");
        assertThat(SongInfoImportService.normalizeArtist("  ")).isNull();
        assertThat(SongInfoImportService.normalizeArtist(null)).isNull();
        assertThat(SongInfoImportService.normalizeArtist("a".repeat(255))).hasSize(255);
        assertThat(SongInfoImportService.normalizeArtist("a".repeat(256))).isNull();
    }

    // ---------------------------------------------------------------- 저장

    @Test
    void 고른_항목만_반영하고_감사_로그를_한_번_남긴다() {
        Song a = song(10L, "Song A", null, null, null);
        Song b = song(11L, "Song B", null, null, null);
        Song c = song(12L, "Song C", "Old", 100, 100);

        SongInfoCommitResponse result = commit(
                List.of(new Selection(10L, true, true), new Selection(12L, true, false)),
                row("Song A", "Artist A", "180"),
                row("Song B", "Artist B", "150"),
                row("Song C", "New Artist", "200"));

        assertThat(result.artistFilled()).isEqualTo(1);
        assertThat(result.artistOverwritten()).isEqualTo(1);
        assertThat(result.bpmFilled()).isEqualTo(1);
        assertThat(result.bpmOverwritten()).isZero();
        assertThat(result.skipped()).isZero();
        assertThat(a.getArtist()).isEqualTo("Artist A");
        assertThat(a.getBpmMin()).isEqualTo(180);
        assertThat(a.getBpmMax()).isEqualTo(180);
        assertThat(b.getArtist()).isNull(); // 고르지 않은 곡은 그대로
        assertThat(c.getArtist()).isEqualTo("New Artist");
        assertThat(c.getBpmMin()).isEqualTo(100); // 고르지 않은 항목(BPM)은 그대로

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLog log = captor.getValue();
        assertThat(log.getAction()).isEqualTo("SONG_INFO_IMPORT");
        assertThat(log.getDetail())
                .containsEntry("artistFilled", 1).containsEntry("artistOverwritten", 1)
                .containsEntry("bpmFilled", 1).containsEntry("bpmOverwritten", 0);
        assertThat(log.getDetail().get("songIds")).isEqualTo(List.of(10L, 12L));
        // 곡명·아티스트·BPM 같은 값은 감사 로그에 넣지 않는다
        assertThat(log.getDetail().toString()).doesNotContain("Artist A", "Song A", "New Artist", "180");
    }

    @Test
    void 지금은_바뀔_것이_없는_항목을_고르면_건너뛰고_개수로_알린다() {
        Song same = song(10L, "Same", "Artist", 172, 172);
        song(11L, "NoValue", null, null, null);

        SongInfoCommitResponse result = commit(
                List.of(new Selection(10L, true, true), new Selection(11L, true, true), new Selection(99L, true, false)),
                row("Same", "Artist", "172"),
                row("NoValue", null, null));

        assertThat(result.artistFilled() + result.artistOverwritten() + result.bpmFilled() + result.bpmOverwritten()).isZero();
        assertThat(result.skipped()).isEqualTo(5); // 10: 둘 다 변경 없음, 11: 둘 다 값 없음, 99: 마스터에 없음
        assertThat(same.getArtist()).isEqualTo("Artist");
        verify(auditLogRepository, never()).save(any()); // 바뀐 것이 없으면 감사 로그도 남기지 않는다
    }

    @Test
    void 같은_곡을_여러_번_골라도_한_곡으로_합쳐_반영한다() {
        Song a = song(10L, "Song A", null, null, null);

        SongInfoCommitResponse result = commit(
                List.of(new Selection(10L, true, false), new Selection(10L, false, true)),
                row("Song A", "Artist A", "170-180"));

        assertThat(result.artistFilled()).isEqualTo(1);
        assertThat(result.bpmFilled()).isEqualTo(1);
        assertThat(a.getBpmMin()).isEqualTo(170);
        assertThat(a.getBpmMax()).isEqualTo(180);
    }

    @Test
    void 아티스트_저장값은_정규화된_글자다() {
        Song a = song(10L, "Song A", null, null, null);

        commit(List.of(new Selection(10L, true, false)), row("Song A", "Ｒｙｕ\nfeat. Kobaryo", null));

        assertThat(a.getArtist()).isEqualTo("Ryu feat. Kobaryo");
    }

    @Test
    void RemyWiki_BPM만_보내면_아티스트는_건드리지_않고_덮어쓰기는_고른_곡만_반영한다() {
        // D94: RemyWiki 경로는 artist를 빈 글자로, 항목은 bpm만 고른다
        Song empty = song(10L, "Empty", "Game Artist", null, null);
        Song changed = song(11L, "Changed", "Game Artist", 150, 150);
        Song skipped = song(12L, "NotChosen", "Game Artist", 120, 120);
        Song same = song(13L, "Same", null, 99, 99);

        SongInfoPreviewResponse preview = preview(row("Empty", "", "180"), row("Changed", "", "160-170"), row("NotChosen", "", "130"), row("Same", "", "99"));
        assertThat(preview.rows()).extracting(r -> r.bpm().status().name())
                .containsExactly("FILL", "OVERWRITE", "OVERWRITE", "UNCHANGED");
        assertThat(preview.rows()).extracting(r -> r.artist().status().name()).containsOnly("NONE");

        SongInfoCommitResponse result = commit(
                List.of(new Selection(10L, false, true), new Selection(11L, false, true), new Selection(13L, false, true)),
                row("Empty", "", "180"), row("Changed", "", "160-170"), row("NotChosen", "", "130"), row("Same", "", "99"));

        assertThat(result.bpmFilled()).isEqualTo(1);
        assertThat(result.bpmOverwritten()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(1); // Same: 변경 없음
        assertThat(result.artistFilled() + result.artistOverwritten()).isZero();
        assertThat(empty.getBpmMin()).isEqualTo(180);
        assertThat(changed.getBpmMin()).isEqualTo(160);
        assertThat(changed.getBpmMax()).isEqualTo(170);
        assertThat(skipped.getBpmMin()).isEqualTo(120); // 고르지 않은 덮어쓰기 후보는 그대로
        assertThat(empty.getArtist()).isEqualTo("Game Artist"); // 아티스트는 그대로
        assertThat(changed.getArtist()).isEqualTo("Game Artist");
        assertThat(same.getBpmMin()).isEqualTo(99);
    }
}
