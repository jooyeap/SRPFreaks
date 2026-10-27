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
 * 같은 티어 유저 기록(D53) 집계 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다.
 * 집계 쿼리는 상관 서브쿼리(유저마다 구간 안에서 가장 높은 스냅샷 1개)라서 H2 같은 대체 DB가 아닌 실제 DB로 검증한다.
 *
 * 구간은 [1000, 1100)으로 두고, 총점이 1000 이상 1100 미만인 스냅샷만 "같은 티어"다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class PeerStatsMapperTest {

    static final BigDecimal LO = new BigDecimal("1000");
    static final BigDecimal HI = new BigDecimal("1100");
    static final String SRN_PLUS = NoteOption.SUPER_RANDOM_PLUS.name();

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired PeerStatsMapper mapper;

    User me;
    DifficultyTable table;
    SongDifficulty chartA;
    SongDifficulty chartB;
    int seq = 0;

    @BeforeEach
    void setUp() {
        me = persist(User.create("sub-me", "me@example.com", "나"));
        table = persist(DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS));
        chartA = chart("7.0", PatternType.SINGLE, true);
        chartB = chart("6.5", PatternType.COMPOUND, true);
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private User peer(boolean publicProfile, boolean blocked) {
        int n = ++seq;
        User u = User.create("sub-p" + n, "p" + n + "@example.com", "유저" + n);
        if (publicProfile) {
            u.changeProfilePublic(true);
        }
        if (blocked) {
            u.block();
        }
        return persist(u);
    }

    private User publicPeer() {
        return peer(true, false);
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

    /** 스냅샷 하나 + 채보 줄들. rates는 (채보, 달성률) 쌍. 줄이 없으면 곡별 상세가 없는 옛 스냅샷이다. */
    private SkillSnapshot snapshot(User user, NoteOption option, LocalDate date, String total, Object... chartAndRates) {
        SkillSnapshot s = persist(SkillSnapshot.create(user, option, date, new BigDecimal(total), new BigDecimal("0"), new BigDecimal(total)));
        int rank = 0;
        for (int i = 0; i < chartAndRates.length; i += 2) {
            persist(SkillSnapshotEntry.create(s, (SongDifficulty) chartAndRates[i], SnapshotGroup.SINGLE, ++rank,
                    new BigDecimal((String) chartAndRates[i + 1]), false, new BigDecimal("300.00")));
        }
        return s;
    }

    private SkillSnapshot snapshot(User user, String date, String total, Object... chartAndRates) {
        return snapshot(user, NoteOption.SUPER_RANDOM_PLUS, LocalDate.parse(date), total, chartAndRates);
    }

    private int count() {
        em.flush();
        em.clear();
        return mapper.countBandUsers(me.getId(), SRN_PLUS, LO, HI);
    }

    private List<PeerChartRate> rates(SongDifficulty... charts) {
        em.flush();
        em.clear();
        return mapper.findChartRates(me.getId(), SRN_PLUS, LO, HI, List.of(charts).stream().map(SongDifficulty::getId).toList());
    }

    private static List<BigDecimal> rateValues(List<PeerChartRate> rows, SongDifficulty chart) {
        return rows.stream().filter(r -> r.songDifficultyId().equals(chart.getId())).map(PeerChartRate::rate).toList();
    }

    // ------------------------------------------------------------ 어떤 스냅샷이 집계에 들어가나

    @Test
    void 유저마다_구간_안에서_총점이_가장_높은_스냅샷_하나만_쓴다() {
        User p = publicPeer();
        snapshot(p, "2026-10-01", "1010.00", chartA, "70.00");
        snapshot(p, "2026-10-10", "1050.00", chartA, "90.00");   // 가장 높음 -> 이것만
        snapshot(p, "2026-10-05", "1030.00", chartA, "80.00");

        assertThat(count()).isEqualTo(1);
        assertThat(rateValues(rates(chartA), chartA)).hasSize(1).first().satisfies(r -> assertThat(r).isEqualByComparingTo("90.00"));
    }

    @Test
    void 총점이_같으면_더_최근_날짜의_스냅샷을_쓴다() {
        User p = publicPeer();
        snapshot(p, "2026-10-01", "1050.00", chartA, "70.00");
        snapshot(p, "2026-10-09", "1050.00", chartA, "92.00");

        assertThat(rateValues(rates(chartA), chartA)).hasSize(1).first().satisfies(r -> assertThat(r).isEqualByComparingTo("92.00"));
    }

    @Test
    void 구간_밖_스냅샷은_더_높아도_쓰지_않는다() {
        User p = publicPeer();
        snapshot(p, "2026-10-01", "1050.00", chartA, "85.00");
        snapshot(p, "2026-10-20", "1500.00", chartA, "99.00");   // 더 높은 티어 시절
        snapshot(p, "2026-09-01", "500.00", chartA, "50.00");    // 더 낮은 티어 시절

        assertThat(rateValues(rates(chartA), chartA)).hasSize(1).first().satisfies(r -> assertThat(r).isEqualByComparingTo("85.00"));
    }

    @Test
    void 구간_경계는_아래는_포함_위는_제외() {
        snapshot(publicPeer(), "2026-10-01", "1000.00", chartA, "80.00");   // lo 포함
        snapshot(publicPeer(), "2026-10-01", "1099.99", chartA, "81.00");   // hi 바로 아래 포함
        snapshot(publicPeer(), "2026-10-01", "1100.00", chartA, "82.00");   // hi 제외
        snapshot(publicPeer(), "2026-10-01", "999.99", chartA, "83.00");    // lo 바로 아래 제외

        assertThat(count()).isEqualTo(2);
        assertThat(rateValues(rates(chartA), chartA)).extracting(BigDecimal::doubleValue).containsExactlyInAnyOrder(80.0, 81.0);
    }

    @Test
    void 비공개_차단_그리고_나는_집계에서_빠진다() {
        snapshot(publicPeer(), "2026-10-01", "1050.00", chartA, "90.00");
        snapshot(peer(false, false), "2026-10-01", "1050.00", chartA, "91.00");   // 비공개
        snapshot(peer(true, true), "2026-10-01", "1050.00", chartA, "92.00");     // 차단
        snapshot(me, "2026-10-01", "1050.00", chartA, "93.00");                   // 나

        assertThat(count()).isEqualTo(1);
        assertThat(rateValues(rates(chartA), chartA)).hasSize(1).first().satisfies(r -> assertThat(r).isEqualByComparingTo("90.00"));
    }

    @Test
    void 노트_옵션이_다른_스냅샷은_쓰지_않는다() {
        snapshot(publicPeer(), "2026-10-01", "1050.00", chartA, "90.00");
        snapshot(publicPeer(), NoteOption.NORMAL, LocalDate.parse("2026-10-01"), "1050.00", chartA, "91.00");

        assertThat(count()).isEqualTo(1);
    }

    @Test
    void 곡별_상세가_없는_옛_스냅샷은_건너뛰고_상세가_있는_다음_스냅샷을_쓴다() {
        User p = publicPeer();
        snapshot(p, "2026-10-20", "1090.00");                          // 총점은 더 높지만 상세 없음
        snapshot(p, "2026-10-01", "1050.00", chartA, "88.00");         // 상세 있음 -> 이것을 쓴다

        assertThat(count()).isEqualTo(1);
        assertThat(rateValues(rates(chartA), chartA)).hasSize(1).first().satisfies(r -> assertThat(r).isEqualByComparingTo("88.00"));
    }

    @Test
    void 상세가_있는_스냅샷이_하나도_없는_유저는_인원에_세지_않는다() {
        snapshot(publicPeer(), "2026-10-01", "1050.00");
        snapshot(publicPeer(), "2026-10-01", "1060.00", chartA, "90.00");

        assertThat(count()).isEqualTo(1);
    }

    @Test
    void 스냅샷_자체가_없는_공개_유저는_세지_않고_결과가_없으면_0() {
        publicPeer();

        assertThat(count()).isZero();
        assertThat(rates(chartA)).isEmpty();
    }

    // ------------------------------------------------------------ 채보별 달성률

    @Test
    void 물어본_채보의_줄만_돌려주고_유저당_한_줄이다() {
        User p1 = publicPeer();
        User p2 = publicPeer();
        snapshot(p1, "2026-10-01", "1050.00", chartA, "90.00", chartB, "80.00");
        snapshot(p2, "2026-10-01", "1050.00", chartA, "94.00");

        List<PeerChartRate> onlyA = rates(chartA);
        assertThat(onlyA).extracting(PeerChartRate::songDifficultyId).containsOnly(chartA.getId());
        assertThat(rateValues(onlyA, chartA)).hasSize(2);

        List<PeerChartRate> both = rates(chartA, chartB);
        assertThat(rateValues(both, chartA)).hasSize(2);
        assertThat(rateValues(both, chartB)).hasSize(1);
    }

    @Test
    void 집계_결과에는_유저를_알_수_있는_정보가_없다() {
        // 반환 타입이 (채보 id, 달성률)뿐이다 -> 컴파일 단계에서 user_id/닉네임이 나갈 수 없는 구조임을 고정한다
        assertThat(PeerChartRate.class.getRecordComponents()).extracting(c -> c.getName())
                .containsExactly("songDifficultyId", "rate");
    }

    // ------------------------------------------------------------ 채보 서열표 값

    @Test
    void 채보_값은_레이팅_대상인_것만_나온다() {
        SongDifficulty noTier = chart(null, PatternType.SINGLE, true);
        SongDifficulty excluded = chart("7.0", PatternType.EXCLUDED, true);
        SongDifficulty off = chart("7.0", PatternType.SINGLE, false);
        SongDifficulty deleted = chart("7.0", PatternType.SINGLE, true);
        deleted.delete();
        em.flush();
        em.clear();

        List<PeerChartMeta> meta = mapper.findChartMeta(table.getId(), PatternType.EXCLUDED.getLabel(),
                List.of(chartA.getId(), chartB.getId(), noTier.getId(), excluded.getId(), off.getId(), deleted.getId()));

        assertThat(meta).extracting(PeerChartMeta::songDifficultyId).containsExactlyInAnyOrder(chartA.getId(), chartB.getId());
        PeerChartMeta a = meta.stream().filter(m -> m.songDifficultyId().equals(chartA.getId())).findFirst().orElseThrow();
        assertThat(a.tier()).isEqualByComparingTo("7.0");
        assertThat(a.pattern()).isEqualTo(PatternType.SINGLE.getLabel());
    }
}
