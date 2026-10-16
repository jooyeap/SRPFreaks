package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SnapshotCompareResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SkillSnapshot;
import com.srpfreaks.backend.entity.SkillSnapshotEntry;
import com.srpfreaks.backend.entity.SnapshotGroup;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.SkillSnapshotEntryRepository;
import com.srpfreaks.backend.repository.SkillSnapshotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/** 스냅샷 비교: 직접 만든 두 시점의 목록으로 오른 곡 / 새로 들어온 곡 / 밀려난 곡 / 내려간 곡을 검증한다. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SkillSnapshotCompareServiceTest {

    static final long USER = 7L;
    static final NoteOption OPTION = NoteOption.SUPER_RANDOM_PLUS;
    static final LocalDate D1 = LocalDate.of(2026, 10, 10);
    static final LocalDate D2 = LocalDate.of(2026, 10, 16);

    @Mock SkillSnapshotRepository snapshotRepository;
    @Mock SkillSnapshotEntryRepository entryRepository;
    @Mock SkillService skillService;

    SkillSnapshotCompareService service;
    User owner;

    @BeforeEach
    void setUp() {
        service = new SkillSnapshotCompareService(snapshotRepository, entryRepository, skillService);
        owner = User.create("sub", "a@example.com", "tester");
        ReflectionTestUtils.setField(owner, "id", USER);
        when(skillService.ratingNoteOption()).thenReturn(OPTION);
    }

    // ---- 준비용 도우미

    private SongDifficulty chart(long id, String title) {
        Song song = Song.create(title, "artist", "test", null);
        ReflectionTestUtils.setField(song, "id", id * 10);
        SongDifficulty d = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.00"));
        ReflectionTestUtils.setField(d, "id", id);
        return d;
    }

    private SkillSnapshot snapshot(long id, LocalDate date, String total, User user) {
        SkillSnapshot s = SkillSnapshot.create(user, OPTION, date, new BigDecimal(total), BigDecimal.ZERO, BigDecimal.ZERO);
        ReflectionTestUtils.setField(s, "id", id);
        return s;
    }

    private SkillSnapshotEntry entry(SkillSnapshot s, SongDifficulty d, String rate, String score) {
        return SkillSnapshotEntry.create(s, d, SnapshotGroup.SINGLE, 1, new BigDecimal(rate), false, new BigDecimal(score));
    }

    private SkillEntryResponse live(SongDifficulty d, String rate, String score) {
        return new SkillEntryResponse(1, d.getId(), d.getSong().getId(), d.getSong().getTitle(), d.getInstrumentPart(),
                d.getDifficultyType(), d.getLevel(), null, "단일", new BigDecimal(rate), false, null, null, null, new BigDecimal(score));
    }

    private SongDifficulty a = chart(1, "곡A");
    private SongDifficulty b = chart(2, "곡B");
    private SongDifficulty c = chart(3, "곡C");
    private SongDifficulty dd = chart(4, "곡D");
    private SongDifficulty e = chart(5, "곡E");

    // ---- 스냅샷끼리

    @Test
    void 이전_스냅샷과_비교해_오른_곡_새로_들어온_곡_밀려난_곡_내려간_곡을_나눈다() {
        SkillSnapshot prev = snapshot(1, D1, "100.00", owner);
        SkillSnapshot cur = snapshot(2, D2, "133.92", owner);
        when(snapshotRepository.findById(2L)).thenReturn(Optional.of(cur));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(USER, OPTION, D2))
                .thenReturn(Optional.of(prev));
        when(entryRepository.findAllWithChart(1L)).thenReturn(List.of(
                entry(prev, a, "90.00", "30.00"),   // 오름
                entry(prev, b, "95.00", "40.00"),   // 내려감
                entry(prev, c, "85.00", "20.00"),   // 같음 → 어디에도 없음
                entry(prev, dd, "80.00", "10.00"))); // 밀려남
        when(entryRepository.findAllWithChart(2L)).thenReturn(List.of(
                entry(cur, a, "92.00", "35.50"),
                entry(cur, b, "94.00", "38.00"),
                entry(cur, c, "85.00", "20.00"),
                entry(cur, e, "88.00", "25.00")));  // 새로 들어옴

        SnapshotCompareResponse r = service.compareWithPrevious(USER, 2L);

        assertThat(r.available()).isTrue();
        assertThat(r.fromDate()).isEqualTo(D1);
        assertThat(r.toDate()).isEqualTo(D2);
        assertThat(r.totalChange()).isEqualByComparingTo("33.92");
        assertThat(r.improved()).extracting(x -> x.title()).containsExactly("곡A");
        assertThat(r.improved().get(0).scoreBefore()).isEqualByComparingTo("30.00");
        assertThat(r.improved().get(0).scoreAfter()).isEqualByComparingTo("35.50");
        assertThat(r.declined()).extracting(x -> x.title()).containsExactly("곡B");
        assertThat(r.entered()).extracting(x -> x.title()).containsExactly("곡E");
        assertThat(r.entered().get(0).rateBefore()).isNull();
        assertThat(r.left()).extracting(x -> x.title()).containsExactly("곡D");
        assertThat(r.left().get(0).rateAfter()).isNull();
    }

    @Test
    void 오른_곡은_점수가_많이_오른_순서로_정렬한다() {
        SkillSnapshot prev = snapshot(1, D1, "100.00", owner);
        SkillSnapshot cur = snapshot(2, D2, "120.00", owner);
        when(snapshotRepository.findById(2L)).thenReturn(Optional.of(cur));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(USER, OPTION, D2))
                .thenReturn(Optional.of(prev));
        when(entryRepository.findAllWithChart(1L)).thenReturn(List.of(
                entry(prev, a, "90.00", "30.00"), entry(prev, b, "90.00", "30.00")));
        when(entryRepository.findAllWithChart(2L)).thenReturn(List.of(
                entry(cur, a, "91.00", "31.00"), entry(cur, b, "95.00", "40.00")));

        assertThat(service.compareWithPrevious(USER, 2L).improved()).extracting(x -> x.title()).containsExactly("곡B", "곡A");
    }

    @Test
    void 이전_스냅샷이_없으면_비교할_수_없다() {
        SkillSnapshot only = snapshot(1, D1, "100.00", owner);
        when(snapshotRepository.findById(1L)).thenReturn(Optional.of(only));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(USER, OPTION, D1))
                .thenReturn(Optional.empty());

        SnapshotCompareResponse r = service.compareWithPrevious(USER, 1L);

        assertThat(r.available()).isFalse();
        assertThat(r.reason()).isEqualTo("NO_PREVIOUS");
    }

    @Test
    void 상세가_없는_예전_스냅샷과는_비교할_수_없다() {
        SkillSnapshot prev = snapshot(1, D1, "100.00", owner);
        SkillSnapshot cur = snapshot(2, D2, "120.00", owner);
        when(snapshotRepository.findById(2L)).thenReturn(Optional.of(cur));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(USER, OPTION, D2))
                .thenReturn(Optional.of(prev));
        when(entryRepository.findAllWithChart(1L)).thenReturn(List.of());
        when(entryRepository.findAllWithChart(2L)).thenReturn(List.of(entry(cur, a, "90.00", "30.00")));

        assertThat(service.compareWithPrevious(USER, 2L).reason()).isEqualTo("NO_DETAIL");
    }

    @Test
    void 남의_스냅샷이나_없는_스냅샷은_404다() {
        User other = User.create("sub2", "b@example.com", "other");
        ReflectionTestUtils.setField(other, "id", 99L);
        when(snapshotRepository.findById(2L)).thenReturn(Optional.of(snapshot(2, D2, "120.00", other)));
        when(snapshotRepository.findById(3L)).thenReturn(Optional.empty());

        for (long id : new long[]{2L, 3L}) {
            long target = id;
            assertThatThrownBy(() -> service.compareWithPrevious(USER, target)).isInstanceOfSatisfying(ApiException.class,
                    ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        }
    }

    // ---- 최근 스냅샷 vs 지금

    @Test
    void 지금_레이팅과_최근_스냅샷을_비교한다() {
        SkillSnapshot latest = snapshot(5, D2, "100.00", owner);
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(USER, OPTION)).thenReturn(Optional.of(latest));
        when(entryRepository.findAllWithChart(5L)).thenReturn(List.of(entry(latest, a, "90.00", "30.00")));
        when(skillService.mySkill(USER)).thenReturn(new SkillResponse(OPTION, new BigDecimal("112.50"), new BigDecimal("112.50"),
                BigDecimal.ZERO, null, 15, 25, List.of(live(a, "93.00", "34.00"), live(b, "80.00", "20.00")), List.of()));

        SnapshotCompareResponse r = service.compareLatestWithCurrent(USER);

        assertThat(r.available()).isTrue();
        assertThat(r.toDate()).isNull(); // 지금과의 비교
        assertThat(r.totalChange()).isEqualByComparingTo("12.50");
        assertThat(r.improved()).extracting(x -> x.title()).containsExactly("곡A");
        assertThat(r.entered()).extracting(x -> x.title()).containsExactly("곡B");
    }

    @Test
    void 스냅샷이_없으면_지금과_비교할_수_없다() {
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(USER, OPTION)).thenReturn(Optional.empty());

        assertThat(service.compareLatestWithCurrent(USER).reason()).isEqualTo("NO_SNAPSHOT");
    }

    @Test
    void 최근_스냅샷에_상세가_없으면_지금과_비교할_수_없다() {
        SkillSnapshot latest = snapshot(5, D2, "100.00", owner);
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(USER, OPTION)).thenReturn(Optional.of(latest));
        when(entryRepository.findAllWithChart(5L)).thenReturn(List.of());

        assertThat(service.compareLatestWithCurrent(USER).reason()).isEqualTo("NO_DETAIL");
    }
}
