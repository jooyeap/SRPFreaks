package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.ImportPlayRequest;
import com.srpfreaks.backend.dto.ImportRecentPlaysRequest;
import com.srpfreaks.backend.dto.ImportResultResponse;
import com.srpfreaks.backend.dto.ImportSkipReason;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.entity.TitleKind;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 가져오기 걸러내기 규칙(D34)을 건너뛰는 이유별로 검증한다. 기본 장면: 곡 "Alpha"(Guitar/Bass MASTER), 사용자 기록 없음. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ImportServiceTest {

    static final Long USER_ID = 7L;
    static final Instant NOW = Instant.parse("2026-10-05T00:00:00Z");
    static final long PLAYED_MS = Instant.parse("2026-10-04T12:00:00Z").toEpochMilli();
    static final List<String> SRN_PLUS = List.of("gf_random_5", "gf_button_1", "gf_auto_1");

    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock SongTitleRepository songTitleRepository;
    @Mock OptionRecordRepository optionRecordRepository;
    @Mock UserRepository userRepository;
    @Mock RivalAlertTrigger rivalAlertTrigger;

    ImportService service;
    User user;
    Song alpha;
    SongDifficulty alphaGuitar;
    SongDifficulty alphaBass;
    final List<SongDifficulty> charts = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new ImportService(songDifficultyRepository, songTitleRepository, optionRecordRepository,
                userRepository, rivalAlertTrigger, Clock.fixed(NOW, ZoneOffset.UTC));
        user = User.create("sub", "a@example.com", "tester");
        ReflectionTestUtils.setField(user, "id", USER_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        alpha = song(1L, "Alpha");
        alphaGuitar = chart(11L, alpha, InstrumentPart.GUITAR);
        alphaBass = chart(12L, alpha, InstrumentPart.BASS);
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(charts);
        when(optionRecordRepository.findBestByUser(USER_ID, NoteOption.SUPER_RANDOM_PLUS)).thenReturn(List.of());
        when(songTitleRepository.findByNormalizedTitle(any())).thenReturn(List.of());
    }

    private Song song(Long id, String title) {
        Song s = Song.create(title, "artist", "test", null);
        ReflectionTestUtils.setField(s, "id", id);
        return s;
    }

    private SongDifficulty chart(Long id, Song song, InstrumentPart part) {
        SongDifficulty d = SongDifficulty.create(song, part, DifficultyType.MASTER, new BigDecimal("9.00"));
        ReflectionTestUtils.setField(d, "id", id);
        charts.add(d);
        return d;
    }

    private ImportPlayRequest play(String title, String diff, int rate, int ok, int miss) {
        return new ImportPlayRequest(PLAYED_MS, "gf", title, diff, rate, ok, miss, false, SRN_PLUS);
    }

    private ImportResultResponse run(ImportPlayRequest... plays) {
        return service.importRecentPlays(USER_ID, new ImportRecentPlaysRequest(List.of(plays)));
    }

    private OptionRecord savedOnce() {
        ArgumentCaptor<OptionRecord> captor = ArgumentCaptor.forClass(OptionRecord.class);
        verify(optionRecordRepository).save(captor.capture());
        return captor.getValue();
    }

    private void best(SongDifficulty chart, String rate, boolean fc) {
        when(optionRecordRepository.findBestByUser(USER_ID, NoteOption.SUPER_RANDOM_PLUS))
                .thenReturn(List.of(new RecordBest(chart.getId(), new BigDecimal(rate), fc)));
    }

    @Test
    void 조건에_맞으면_SRN_플러스_기록으로_저장한다() {
        ImportResultResponse result = run(play("Alpha", "gf_mst", 7387, 2, 5));

        assertThat(result.saved()).isEqualTo(1);
        assertThat(result.skipped()).isZero();
        OptionRecord saved = savedOnce();
        assertThat(saved.getSongDifficulty()).isSameAs(alphaGuitar);
        assertThat(saved.getNoteOption()).isEqualTo(NoteOption.SUPER_RANDOM_PLUS);
        assertThat(saved.getAchievementRate()).isEqualByComparingTo("73.87");
        assertThat(saved.isFullCombo()).isFalse();
        assertThat(saved.getPlayedAt()).isEqualTo(Instant.ofEpochMilli(PLAYED_MS));
    }

    @Test
    void 저장하면_이전_최고와_새_최고로_라이벌_알림_판정을_부른다() {
        best(alphaGuitar, "70.00", false);
        run(play("Alpha", "gf_mst", 7387, 2, 5));

        verify(rivalAlertTrigger).recordSaved(eq(USER_ID), eq(11L), eq(NoteOption.SUPER_RANDOM_PLUS),
                argThat(v -> v.compareTo(new BigDecimal("70.00")) == 0), argThat(v -> v.compareTo(new BigDecimal("73.87")) == 0));
    }

    @Test
    void 첫_기록이면_이전_최고는_null로_넘긴다() {
        run(play("Alpha", "gf_mst", 7387, 2, 5));

        verify(rivalAlertTrigger).recordSaved(eq(USER_ID), eq(11L), eq(NoteOption.SUPER_RANDOM_PLUS), isNull(),
                argThat(v -> v.compareTo(new BigDecimal("73.87")) == 0));
    }

    @Test
    void bass_mst는_베이스_채보로_저장한다() {
        run(play("Alpha", "bass_mst", 9000, 1, 1));

        assertThat(savedOnce().getSongDifficulty()).isSameAs(alphaBass);
    }

    @Test
    void 곡명은_정규화해서_비교한다() {
        ImportResultResponse result = run(play("ＡＬＰＨＡ ", "gf_mst", 5000, 1, 1));

        assertThat(result.saved()).isEqualTo(1);
    }

    @Test
    void 마스터에_없는_곡은_건너뛰고_곡명을_알려_준다() {
        ImportResultResponse result = run(play("Unknown", "gf_mst", 9000, 0, 0));

        assertThat(result.saved()).isZero();
        assertThat(result.skippedByReason()).containsEntry(ImportSkipReason.SONG_NOT_FOUND, 1);
        assertThat(result.excludedSongs()).containsExactly("Unknown");
        verify(optionRecordRepository, never()).save(any());
    }

    @Test
    void 곡은_있지만_해당_파트_채보가_없으면_제외_곡으로_알린다() {
        Song beta = song(2L, "Beta");
        chart(21L, beta, InstrumentPart.GUITAR);

        ImportResultResponse result = run(play("Beta", "bass_mst", 9000, 1, 1));

        assertThat(result.skippedByReason()).containsEntry(ImportSkipReason.SONG_NOT_FOUND, 1);
        assertThat(result.excludedSongs()).containsExactly("Beta");
    }

    @Test
    void 별칭_표기로도_곡을_찾는다() {
        SongTitle alias = SongTitle.create(alpha, TitleKind.ALIAS, "アルファ");
        when(songTitleRepository.findByNormalizedTitle(SongTitle.normalize("アルファ"))).thenReturn(List.of(alias));

        assertThat(run(play("アルファ", "gf_mst", 5000, 1, 1)).saved()).isEqualTo(1);
    }

    @Test
    void 제목이_같은_곡이_둘이면_모호해서_건너뛴다() {
        Song other = song(3L, "Alpha");
        chart(31L, other, InstrumentPart.GUITAR);

        ImportResultResponse result = run(play("Alpha", "gf_mst", 5000, 1, 1));

        assertThat(result.skippedByReason()).containsEntry(ImportSkipReason.AMBIGUOUS_SONG, 1);
        verify(optionRecordRepository, never()).save(any());
    }

    @Test
    void 번역된_페이지에서_읽은_값은_받지_않는다() {
        ImportPlayRequest p = new ImportPlayRequest(PLAYED_MS, "gf", "Alpha", "gf_mst", 5000, 1, 1, true, SRN_PLUS);

        assertThat(run(p).skippedByReason()).containsEntry(ImportSkipReason.TRANSLATED_PAGE, 1);
    }

    @Test
    void 옵션이_SRN_플러스_조합과_정확히_다르면_건너뛴다() {
        List<List<String>> wrong = List.of(
                List.of("gf_random_4", "gf_button_1", "gf_auto_1"),
                List.of("gf_random_5", "gf_button_2", "gf_auto_1"),
                List.of("gf_random_5", "gf_button_1", "gf_auto_2"),
                List.of("gf_random_5", "gf_button_1"),
                List.of("gf_random_5", "gf_button_1", "gf_auto_1", "gf_extra_1"),
                List.of());
        for (List<String> options : wrong) {
            ImportPlayRequest p = new ImportPlayRequest(PLAYED_MS, "gf", "Alpha", "gf_mst", 5000, 1, 1, false, options);
            assertThat(run(p).skippedByReason()).containsEntry(ImportSkipReason.OPTION_NOT_SUPPORTED, 1);
        }
        verify(optionRecordRepository, never()).save(any());
    }

    @Test
    void 옵션_순서가_달라도_같은_조합이면_받는다() {
        ImportPlayRequest p = new ImportPlayRequest(PLAYED_MS, "gf", "Alpha", "gf_mst", 5000, 1, 1, false,
                List.of("gf_auto_1", "gf_random_5", "gf_button_1"));

        assertThat(run(p).saved()).isEqualTo(1);
    }

    @Test
    void 기타드럼_게임_종류가_gf가_아니면_건너뛴다() {
        ImportPlayRequest p = new ImportPlayRequest(PLAYED_MS, "dm", "Alpha", "gf_mst", 5000, 1, 1, false, SRN_PLUS);

        assertThat(run(p).skippedByReason()).containsEntry(ImportSkipReason.UNSUPPORTED_GAME_TYPE, 1);
    }

    @Test
    void 확인되지_않은_난이도_클래스는_건너뛴다() {
        assertThat(run(play("Alpha", "dm_ext", 5000, 1, 1)).skippedByReason())
                .containsEntry(ImportSkipReason.UNKNOWN_DIFFICULTY, 1);
    }

    @Test
    void 미래_시각은_받지_않는다() {
        long future = NOW.plusSeconds(3 * 86_400).toEpochMilli();
        ImportPlayRequest p = new ImportPlayRequest(future, "gf", "Alpha", "gf_mst", 5000, 1, 1, false, SRN_PLUS);

        assertThat(run(p).skippedByReason()).containsEntry(ImportSkipReason.INVALID_VALUE, 1);
    }

    @Test
    void 풀콤보는_MAX이거나_MISS와_OK가_모두_0일_때만이다() {
        assertThat(ImportService.isFullCombo(play("A", "gf_mst", 10000, 3, 3))).isTrue();
        assertThat(ImportService.isFullCombo(play("A", "gf_mst", 9500, 0, 0))).isTrue();
        assertThat(ImportService.isFullCombo(play("A", "gf_mst", 9500, 1, 0))).isFalse();
        assertThat(ImportService.isFullCombo(play("A", "gf_mst", 9500, 0, 1))).isFalse();
    }

    @Test
    void MAX는_100점_풀콤보로_저장한다() {
        run(play("Alpha", "gf_mst", 10000, 0, 0));

        OptionRecord saved = savedOnce();
        assertThat(saved.getAchievementRate()).isEqualByComparingTo("100.00");
        assertThat(saved.isFullCombo()).isTrue();
    }

    @Test
    void 기존_최고보다_낮으면_저장하지_않는다() {
        best(alphaGuitar, "80.00", false);

        ImportResultResponse result = run(play("Alpha", "gf_mst", 7999, 1, 1));

        assertThat(result.skippedByReason()).containsEntry(ImportSkipReason.LOWER_THAN_BEST, 1);
        assertThat(result.excludedSongs()).isEmpty();
        verify(optionRecordRepository, never()).save(any());
    }

    @Test
    void 기존_최고보다_높으면_저장한다() {
        best(alphaGuitar, "80.00", false);

        assertThat(run(play("Alpha", "gf_mst", 8001, 1, 1)).saved()).isEqualTo(1);
    }

    @Test
    void 같은_달성률은_풀콤보를_새로_얻을_때만_저장한다() {
        best(alphaGuitar, "95.00", false);
        assertThat(run(play("Alpha", "gf_mst", 9500, 0, 0)).saved()).isEqualTo(1);
    }

    @Test
    void 같은_달성률이고_개선이_없으면_저장하지_않는다() {
        best(alphaGuitar, "95.00", true);

        ImportResultResponse result = run(play("Alpha", "gf_mst", 9500, 0, 0));

        assertThat(result.skippedByReason()).containsEntry(ImportSkipReason.NOT_IMPROVED, 1);
        verify(optionRecordRepository, never()).save(any());
    }

    @Test
    void 한_요청에_같은_채보가_여러_번이면_가장_높은_하나만_저장한다() {
        ImportResultResponse result = run(
                play("Alpha", "gf_mst", 7000, 1, 1),
                play("Alpha", "gf_mst", 9000, 1, 1),
                play("Alpha", "gf_mst", 8000, 1, 1));

        assertThat(result.saved()).isEqualTo(1);
        assertThat(result.results().get(1).saved()).isTrue();
        assertThat(result.results().get(0).reason()).isEqualTo(ImportSkipReason.LOWER_THAN_BEST);
        assertThat(result.results().get(2).reason()).isEqualTo(ImportSkipReason.LOWER_THAN_BEST);
        assertThat(savedOnce().getAchievementRate()).isEqualByComparingTo("90.00");
    }

    @Test
    void 결과는_요청_순서를_유지하고_합계가_맞는다() {
        ImportResultResponse result = run(
                play("Unknown", "gf_mst", 9000, 1, 1),
                play("Alpha", "gf_mst", 9000, 1, 1),
                play("Alpha", "bass_mst", 9000, 1, 1));

        assertThat(result.saved()).isEqualTo(2);
        assertThat(result.skipped()).isEqualTo(1);
        assertThat(result.results()).extracting(r -> r.index()).containsExactly(0, 1, 2);
        verify(optionRecordRepository, times(2)).save(any());
    }

    // ---- 미리보기(D40): 저장 없이 같은 규칙으로 결과만 돌려준다 ----

    private ImportResultResponse preview(ImportPlayRequest... plays) {
        return service.previewRecentPlays(USER_ID, new ImportRecentPlaysRequest(List.of(plays)));
    }

    @Test
    void 미리보기는_저장하지_않고_저장될_건을_saved로_알려_준다() {
        ImportResultResponse result = preview(play("Alpha", "gf_mst", 7387, 2, 5));

        assertThat(result.saved()).isEqualTo(1);
        assertThat(result.results().get(0).saved()).isTrue();
        assertThat(result.results().get(0).previousBestRate()).isNull(); // 첫 기록
        verify(optionRecordRepository, never()).save(any());
    }

    @Test
    void 미리보기도_저장과_같은_이유로_건너뛰고_기존_최고_기록을_함께_준다() {
        best(alphaGuitar, "90.00", false);

        ImportResultResponse lower = preview(play("Alpha", "gf_mst", 8000, 1, 1));
        assertThat(lower.results().get(0).saved()).isFalse();
        assertThat(lower.results().get(0).reason()).isEqualTo(ImportSkipReason.LOWER_THAN_BEST);
        assertThat(lower.results().get(0).previousBestRate()).isEqualByComparingTo("90.00");

        ImportResultResponse higher = preview(play("Alpha", "gf_mst", 9650, 1, 1));
        assertThat(higher.results().get(0).saved()).isTrue();
        assertThat(higher.results().get(0).previousBestRate()).isEqualByComparingTo("90.00");
        verify(optionRecordRepository, never()).save(any());
    }

    @Test
    void 미리보기에서도_곡_목록에_없는_곡은_제외곡으로_알려_준다() {
        ImportResultResponse result = preview(play("없는곡", "gf_mst", 8000, 1, 1));

        assertThat(result.excludedSongs()).containsExactly("없는곡");
        assertThat(result.results().get(0).reason()).isEqualTo(ImportSkipReason.SONG_NOT_FOUND);
    }

    @Test
    void 저장은_미리보기와_달리_기록을_남긴다() {
        ImportResultResponse result = run(play("Alpha", "gf_mst", 9650, 1, 1));

        assertThat(result.results().get(0).saved()).isTrue();
        assertThat(savedOnce().getAchievementRate()).isEqualByComparingTo("96.50");
    }
}
