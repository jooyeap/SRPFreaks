package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.SkillSnapshot;
import com.srpfreaks.backend.entity.SkillSnapshotEntry;
import com.srpfreaks.backend.entity.SnapshotGroup;
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
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 약점 분석(D72)의 같은 티어 속성별·난이도대별 집계 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다.
 * 구간은 [1000, 1100)이다. 쿼리는 유저 수·줄 수·평균만 돌려주므로(user_id를 읽지 않는다) 결과 레코드에 유저 식별 정보가 없다는 것도 타입으로 보장된다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class PeerStatsAverageMapperTest {

    static final BigDecimal LO = new BigDecimal("1000");
    static final BigDecimal HI = new BigDecimal("1100");
    static final BigDecimal WIDTH = new BigDecimal("0.5");
    static final String SRN_PLUS = NoteOption.SUPER_RANDOM_PLUS.name();
    static final String EXCLUDED = PatternType.EXCLUDED.getLabel();
    static final String COMPOSITE = PatternType.COMPOSITE_SINGLE.getLabel();
    static final String COMPOUND = PatternType.COMPOUND.getLabel();

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired PeerStatsMapper mapper;

    User me;
    DifficultyTable table;
    int seq = 0;

    @BeforeEach
    void setUp() {
        me = persist(User.create("sub-me", "me@example.com", "meuser"));
        table = persist(DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS));
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private User peer(boolean publicProfile) {
        int n = ++seq;
        User u = User.create("sub-p" + n, "p" + n + "@example.com", "peer" + n);
        if (publicProfile) {
            u.changeProfilePublic(true);
        }
        return persist(u);
    }

    private SongDifficulty chart(String tier, PatternType pattern, boolean ratingEnabled) {
        Song song = persist(Song.create("곡" + (++seq), null, "test", null));
        SongDifficulty d = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        DifficultyTableEntry e = DifficultyTableEntry.create(table, d);
        e.changeTier(tier == null ? null : new BigDecimal(tier), false, null);
        e.changePattern(pattern, false);
        e.changeRatingEnabled(ratingEnabled);
        persist(e);
        return d;
    }

    private SongDifficulty chart(String tier, PatternType pattern) {
        return chart(tier, pattern, true);
    }

    private void snapshot(User user, String total, Object... chartAndRates) {
        SkillSnapshot s = persist(SkillSnapshot.create(user, NoteOption.SUPER_RANDOM_PLUS, LocalDate.parse("2026-10-01"),
                new BigDecimal(total), new BigDecimal("0"), new BigDecimal(total)));
        int rank = 0;
        for (int i = 0; i < chartAndRates.length; i += 2) {
            persist(SkillSnapshotEntry.create(s, (SongDifficulty) chartAndRates[i], SnapshotGroup.SINGLE, ++rank,
                    new BigDecimal((String) chartAndRates[i + 1]), false, new BigDecimal("300.00")));
        }
    }

    private List<PeerGroupAverage> patterns() {
        em.flush();
        em.clear();
        return mapper.findPatternAverages(me.getId(), SRN_PLUS, LO, HI, table.getId(), EXCLUDED, COMPOSITE, COMPOUND);
    }

    private List<PeerBandAverage> bands() {
        em.flush();
        em.clear();
        return mapper.findBandAverages(me.getId(), SRN_PLUS, LO, HI, table.getId(), EXCLUDED, WIDTH);
    }

    private static PeerGroupAverage of(List<PeerGroupAverage> rows, PatternType pattern) {
        return rows.stream().filter(r -> r.pattern().equals(pattern.getLabel())).findFirst().orElse(null);
    }

    private static PeerBandAverage of(List<PeerBandAverage> rows, String band) {
        return rows.stream().filter(r -> r.band().compareTo(new BigDecimal(band)) == 0).findFirst().orElse(null);
    }

    // ------------------------------------------------------------ 속성별

    @Test
    void 속성별로_유저_수_줄_수_평균을_낸다() {
        SongDifficulty single1 = chart("7.0", PatternType.SINGLE);
        SongDifficulty single2 = chart("6.5", PatternType.SINGLE);
        SongDifficulty triple = chart("7.0", PatternType.TRIPLE);
        snapshot(peer(true), "1050.00", single1, "90.00", single2, "80.00", triple, "70.00");
        snapshot(peer(true), "1060.00", single1, "100.00");

        List<PeerGroupAverage> rows = patterns();
        PeerGroupAverage single = of(rows, PatternType.SINGLE);
        assertThat(single.users()).isEqualTo(2);
        assertThat(single.entries()).isEqualTo(3);
        assertThat(single.avgRate()).isEqualByComparingTo("90.00");   // (90 + 80 + 100) / 3 = 90 (채보 가중)
        PeerGroupAverage tri = of(rows, PatternType.TRIPLE);
        assertThat(tri.users()).isEqualTo(1);
        assertThat(tri.avgRate()).isEqualByComparingTo("70.00");
        assertThat(of(rows, PatternType.DOUBLE)).isNull();   // 줄이 없는 속성은 나오지 않는다
    }

    @Test
    void 복합_단일은_복합과_한_묶음으로_센다() {
        SongDifficulty compound = chart("7.0", PatternType.COMPOUND);
        SongDifficulty composite = chart("7.0", PatternType.COMPOSITE_SINGLE);
        snapshot(peer(true), "1050.00", compound, "80.00", composite, "90.00");

        List<PeerGroupAverage> rows = patterns();
        assertThat(rows).hasSize(1);
        assertThat(of(rows, PatternType.COMPOUND).entries()).isEqualTo(2);
        assertThat(of(rows, PatternType.COMPOUND).users()).isEqualTo(1);   // 한 유저의 두 줄이라 유저 수는 1
        assertThat(of(rows, PatternType.COMPOUND).avgRate()).isEqualByComparingTo("85.00");
        assertThat(of(rows, PatternType.COMPOSITE_SINGLE)).isNull();
    }

    @Test
    void 기준_난이도나_속성이_없거나_레이팅_제외_반영_끔인_채보는_집계에서_뺀다() {
        SongDifficulty ok = chart("7.0", PatternType.SINGLE);
        SongDifficulty noTier = chart(null, PatternType.SINGLE);
        SongDifficulty excluded = chart("7.0", PatternType.EXCLUDED);
        SongDifficulty noPattern = chart("7.0", null);
        SongDifficulty disabled = chart("7.0", PatternType.SINGLE, false);
        snapshot(peer(true), "1050.00", ok, "80.00", noTier, "10.00", excluded, "20.00", noPattern, "30.00", disabled, "40.00");

        List<PeerGroupAverage> rows = patterns();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).entries()).isEqualTo(1);
        assertThat(rows.get(0).avgRate()).isEqualByComparingTo("80.00");
        assertThat(bands()).hasSize(1);
    }

    @Test
    void 나_비공개_구간_밖_유저는_집계에서_빠진다() {
        SongDifficulty c = chart("7.0", PatternType.SINGLE);
        snapshot(peer(true), "1050.00", c, "90.00");
        snapshot(peer(false), "1050.00", c, "10.00");   // 비공개
        snapshot(me, "1050.00", c, "20.00");            // 나
        snapshot(peer(true), "1100.00", c, "30.00");    // 구간 위 경계(제외)
        snapshot(peer(true), "999.99", c, "40.00");     // 구간 아래 경계 바로 밑(제외)
        snapshot(peer(true), "1000.00", c, "50.00");    // 구간 아래 경계(포함)

        PeerGroupAverage single = of(patterns(), PatternType.SINGLE);
        assertThat(single.users()).isEqualTo(2);
        assertThat(single.avgRate()).isEqualByComparingTo("70.00");   // (90 + 50) / 2
    }

    // ------------------------------------------------------------ 난이도대별

    @Test
    void 난이도대는_0점5_단위로_묶는다() {
        SongDifficulty a = chart("5.5", PatternType.SINGLE);   // 5.5 묶음 시작
        SongDifficulty b = chart("5.9", PatternType.COMPOUND);  // 5.5 묶음 끝
        SongDifficulty c = chart("6.0", PatternType.SINGLE);   // 6.0 묶음 시작
        SongDifficulty d = chart("6.4", PatternType.SINGLE);   // 6.0 묶음
        snapshot(peer(true), "1050.00", a, "80.00", b, "90.00", c, "70.00", d, "72.00");
        snapshot(peer(true), "1060.00", a, "100.00");

        List<PeerBandAverage> rows = bands();
        assertThat(rows).hasSize(2);
        PeerBandAverage low = of(rows, "5.5");
        assertThat(low.users()).isEqualTo(2);
        assertThat(low.entries()).isEqualTo(3);
        assertThat(low.avgRate()).isEqualByComparingTo("90.00");   // (80 + 90 + 100) / 3
        PeerBandAverage high = of(rows, "6.0");
        assertThat(high.users()).isEqualTo(1);
        assertThat(high.avgRate()).isEqualByComparingTo("71.00");
    }

    @Test
    void 곡별_상세가_없는_옛_스냅샷만_있으면_집계가_비어_있다() {
        SongDifficulty c = chart("7.0", PatternType.SINGLE);
        snapshot(peer(true), "1050.00");   // 줄이 없다

        assertThat(patterns()).isEmpty();
        assertThat(bands()).isEmpty();
    }
}
