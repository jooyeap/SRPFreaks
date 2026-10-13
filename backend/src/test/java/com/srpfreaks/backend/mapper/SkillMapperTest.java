package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.autoconfigure.MybatisAutoConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 레이팅 후보 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다.
 * JPA로 데이터를 넣고(flush) 같은 트랜잭션 안에서 MyBatis가 읽는다. 둘 다 같은 DataSource 연결을 쓴다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SkillMapperTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired SkillMapper mapper;

    User userA;
    User userB;
    DifficultyTable table;
    DifficultyTable otherTable;
    int songSeq = 0;

    @BeforeEach
    void setUp() {
        userA = persist(User.create("sub-a", "a@example.com", null));
        userB = persist(User.create("sub-b", "b@example.com", null));
        table = persist(DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS));
        otherTable = persist(DifficultyTable.create("다른 표", null, NoteOption.SUPER_RANDOM_PLUS));
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    /** 곡 + 채보 하나를 만들고 서열표(table)에 올린다. tier/pattern이 null이면 해당 값을 비워 둔다. */
    private SongDifficulty chart(String tier, PatternType pattern) {
        Song song = persist(Song.create("곡" + (++songSeq), null, "test", null));
        SongDifficulty d = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        DifficultyTableEntry e = DifficultyTableEntry.create(table, d);
        e.changeTier(tier == null ? null : new BigDecimal(tier), false, null);
        e.changePattern(pattern, false);
        e.changeRatingEnabled(true); // 새 줄은 꺼짐으로 시작하므로, 계산 대상으로 쓰려면 켠다
        persist(e);
        return d;
    }

    private void record(User user, SongDifficulty d, NoteOption option, String rate, boolean fc) {
        persist(OptionRecord.create(user, d, option, new BigDecimal(rate), fc, null, null, null));
    }

    private void recordAt(User user, SongDifficulty d, String rate, java.time.Instant playedAt) {
        persist(OptionRecord.create(user, d, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(rate), false, playedAt, null, null));
    }

    private List<RatingCandidate> query(User user) {
        em.flush();
        em.clear();
        return mapper.findRatingCandidates(user.getId(), NoteOption.SUPER_RANDOM_PLUS.name(), table.getId(),
                PatternType.EXCLUDED.getLabel());
    }

    @Test
    void 채보별_최고_달성률과_FC_여부를_구하고_서열표_값을_붙인다() {
        SongDifficulty d = chart("6.0", PatternType.SINGLE);
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "90.00", false);
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "95.50", true);    // 최고 + FC
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "80.00", false);

        List<RatingCandidate> rows = query(userA);

        assertThat(rows).hasSize(1);
        RatingCandidate c = rows.get(0);
        assertThat(c.songDifficultyId()).isEqualTo(d.getId());
        assertThat(c.bestRate()).isEqualByComparingTo("95.50");
        assertThat(c.fullCombo()).isTrue();
        assertThat(c.tier()).isEqualByComparingTo("6.0");
        assertThat(c.pattern()).isEqualTo("단일");
        assertThat(c.part()).isEqualTo("GUITAR");
        assertThat(c.difficulty()).isEqualTo("MASTER");
        assertThat(c.level()).isEqualByComparingTo("9.50");
        assertThat(c.title()).startsWith("곡");
    }

    @Test
    void FC_기록이_없으면_FC가_아니다() {
        SongDifficulty d = chart("6.0", PatternType.SINGLE);
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "90.00", false);

        assertThat(query(userA).get(0).fullCombo()).isFalse();
    }

    @Test
    void SRN_플러스가_아닌_옵션의_기록은_쓰지_않는다() {
        SongDifficulty onlyNormal = chart("6.0", PatternType.SINGLE);
        record(userA, onlyNormal, NoteOption.NORMAL, "99.00", false);
        SongDifficulty mixed = chart("6.0", PatternType.SINGLE);
        record(userA, mixed, NoteOption.RANDOM, "99.00", false);
        record(userA, mixed, NoteOption.SUPER_RANDOM_PLUS, "70.00", false);

        List<RatingCandidate> rows = query(userA);

        assertThat(rows).extracting(RatingCandidate::songDifficultyId).containsExactly(mixed.getId());
        assertThat(rows.get(0).bestRate()).isEqualByComparingTo("70.00");   // 99.00(RANDOM)이 섞이지 않는다
    }

    @Test
    void 다른_사용자의_기록은_섞이지_않는다() {
        SongDifficulty d = chart("6.0", PatternType.SINGLE);
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "80.00", false);
        record(userB, d, NoteOption.SUPER_RANDOM_PLUS, "100.00", true);

        List<RatingCandidate> rows = query(userA);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).bestRate()).isEqualByComparingTo("80.00");
        assertThat(rows.get(0).fullCombo()).isFalse();
    }

    @Test
    void 기준_난이도가_없거나_속성이_없거나_레이팅_제외인_채보는_빠진다() {
        SongDifficulty ok = chart("6.0", PatternType.COMPOUND);
        SongDifficulty noTier = chart(null, PatternType.SINGLE);
        SongDifficulty noPattern = chart("6.0", null);
        SongDifficulty excluded = chart("6.0", PatternType.EXCLUDED);
        for (SongDifficulty d : List.of(ok, noTier, noPattern, excluded)) {
            record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "90.00", false);
        }

        assertThat(query(userA)).extracting(RatingCandidate::songDifficultyId).containsExactly(ok.getId());
    }

    @Test
    void 레이팅_반영을_끈_채보는_기준_난이도와_속성이_있어도_빠진다() {
        SongDifficulty on = chart("6.0", PatternType.SINGLE);
        // 스위치를 켜지 않은 줄(새 줄의 기본값 = 꺼짐). 기준 난이도와 속성은 다 있다.
        Song song = persist(Song.create("스위치 꺼진 곡", null, "test", null));
        SongDifficulty off = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        DifficultyTableEntry e = DifficultyTableEntry.create(table, off);
        e.changeTier(new BigDecimal("6.0"), false, null);
        e.changePattern(PatternType.SINGLE, false);
        persist(e);
        for (SongDifficulty d : List.of(on, off)) {
            record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "90.00", false);
        }

        assertThat(query(userA)).extracting(RatingCandidate::songDifficultyId).containsExactly(on.getId());
    }

    @Test
    void 서열표에_없는_채보와_다른_표의_항목은_빠진다() {
        SongDifficulty notInTable = persist(SongDifficulty.create(
                persist(Song.create("표에 없음", null, "test", null)),
                InstrumentPart.BASS, DifficultyType.EXTREME, new BigDecimal("8.00")));
        record(userA, notInTable, NoteOption.SUPER_RANDOM_PLUS, "90.00", false);

        // 다른 서열표에만 올라간 채보
        Song song = persist(Song.create("다른 표 곡", null, "test", null));
        SongDifficulty inOtherTable = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.00")));
        DifficultyTableEntry e = DifficultyTableEntry.create(otherTable, inOtherTable);
        e.changeTier(new BigDecimal("6.0"), false, null);
        e.changePattern(PatternType.SINGLE, false);
        e.changeRatingEnabled(true);
        persist(e);
        record(userA, inOtherTable, NoteOption.SUPER_RANDOM_PLUS, "90.00", false);

        assertThat(query(userA)).isEmpty();
    }

    @Test
    void 삭제된_곡과_삭제된_채보는_빠진다() {
        SongDifficulty deletedChart = chart("6.0", PatternType.SINGLE);
        deletedChart.delete();
        SongDifficulty deletedSong = chart("6.0", PatternType.SINGLE);
        deletedSong.getSong().delete();
        SongDifficulty alive = chart("6.0", PatternType.SINGLE);
        for (SongDifficulty d : List.of(deletedChart, deletedSong, alive)) {
            record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "90.00", false);
        }

        assertThat(query(userA)).extracting(RatingCandidate::songDifficultyId).containsExactly(alive.getId());
    }

    @Test
    void 같은_곡의_다른_채보는_각각_후보다() {
        Song song = persist(Song.create("한 곡", null, "test", null));
        SongDifficulty guitar = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        SongDifficulty bass = persist(SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("9.00")));
        for (SongDifficulty d : List.of(guitar, bass)) {
            DifficultyTableEntry e = DifficultyTableEntry.create(table, d);
            e.changeTier(new BigDecimal("6.0"), false, null);
            e.changePattern(PatternType.SINGLE, false);
            e.changeRatingEnabled(true);
            persist(e);
            record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "90.00", false);
        }

        assertThat(query(userA)).hasSize(2);
    }

    @Test
    void 달성_시각은_최고_달성률을_처음_기록한_시각이다() {
        SongDifficulty d = chart("6.0", PatternType.SINGLE);
        recordAt(userA, d, "90.00", java.time.Instant.parse("2026-10-01T00:00:00Z"));
        recordAt(userA, d, "95.50", java.time.Instant.parse("2026-10-02T00:00:00Z"));   // 최고 점수를 처음 낸 시각
        recordAt(userA, d, "95.50", java.time.Instant.parse("2026-10-05T00:00:00Z"));   // 같은 점수를 또 냈다 -> 더 이른 쪽을 쓴다
        recordAt(userA, d, "80.00", java.time.Instant.parse("2026-10-09T00:00:00Z"));   // 낮은 점수는 늦게 내도 무관

        List<RatingCandidate> rows = query(userA);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).achievedAt()).isEqualTo(java.time.LocalDateTime.of(2026, 10, 2, 0, 0));
    }
}
