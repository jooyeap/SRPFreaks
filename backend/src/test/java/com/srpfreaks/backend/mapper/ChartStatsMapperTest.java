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
import org.mybatis.spring.SqlSessionTemplate;
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
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 서열표 분석(D77) 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다(CI에서만 돈다).
 * 핵심은 개인정보다: 비공개·차단·닉네임 없는 유저의 기록은 채보 집계, 인원, 유저 목록, 레이팅 후보 어디에도 들어가지 않는다.
 * 최근 7일 경계는 created_at(서버 저장 시각)에 달려 있어서 저장 뒤에 created_at을 직접 정해 둔다(엔티티는 저장 시각을 스스로 채운다).
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class ChartStatsMapperTest {

    static final String SRN_PLUS = NoteOption.SUPER_RANDOM_PLUS.name();
    static final LocalDateTime SINCE = LocalDateTime.of(2026, 11, 7, 15, 0);   // 2026-11-08 00:00 KST

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired ChartStatsMapper mapper;
    @Autowired SkillMapper skillMapper;
    @Autowired SqlSessionTemplate sqlSession;

    DifficultyTable table;
    int seq = 0;

    @BeforeEach
    void setUp() {
        table = persist(DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS));
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private User user(boolean publicProfile) {
        int n = ++seq;
        User u = User.create("sub-u" + n, "u" + n + "@example.com", "nick" + n);
        if (publicProfile) {
            u.changeProfilePublic(true);
        }
        return persist(u);
    }

    private User blockedPublicUser() {
        User u = user(true);
        u.block();
        return u;
    }

    /** 서열표에 기준 난이도 tier로 올라간 채보. tier가 null이면 서열표에는 있지만 기준 난이도가 없는(미정) 채보. */
    private SongDifficulty chart(String tier, PatternType pattern) {
        Song song = persist(Song.create("곡" + (++seq), null, "test", null));
        SongDifficulty d = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        DifficultyTableEntry e = DifficultyTableEntry.create(table, d);
        e.changeTier(tier == null ? null : new BigDecimal(tier), false, null);
        e.changePattern(pattern, false);
        e.changeRatingEnabled(true);   // 새 줄은 꺼짐으로 시작하므로, 레이팅 후보 쿼리(rating_enabled = TRUE)에 잡히려면 켠다(SkillMapperTest와 같은 준비)
        persist(e);
        return d;
    }

    /** 서열표에 아예 없는 채보. */
    private SongDifficulty chartNotInTable() {
        Song song = persist(Song.create("곡" + (++seq), null, "test", null));
        return persist(SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.EXTREME, new BigDecimal("8.50")));
    }

    private OptionRecord record(User user, SongDifficulty d, NoteOption option, String rate, LocalDateTime createdAt) {
        OptionRecord r = persist(OptionRecord.create(user, d, option, new BigDecimal(rate), false, (Instant) null, null, null));
        em.flush();
        em.createNativeQuery("UPDATE option_records SET created_at = ?1 WHERE option_record_id = ?2")
                .setParameter(1, createdAt).setParameter(2, r.getId()).executeUpdate();
        return r;
    }

    private OptionRecord record(User user, SongDifficulty d, String rate) {
        return record(user, d, NoteOption.SUPER_RANDOM_PLUS, rate, SINCE.minusDays(30));
    }

    private List<ChartAggregateRow> aggregates() {
        em.flush();
        em.clear();
        // MyBatis는 한 트랜잭션 안에서 같은 SQL·파라미터의 결과를 캐시하므로(1차 캐시) 데이터를 바꿔 가며 같은 쿼리를 다시 부르는 테스트는 캐시를 비운다
        sqlSession.clearCache();
        return mapper.findChartAggregates(SRN_PLUS, table.getId(), SINCE);
    }

    private ChartAggregateRow aggregateOf(SongDifficulty d) {
        return aggregates().stream().filter(r -> r.songDifficultyId().equals(d.getId())).findFirst().orElse(null);
    }

    // ---- 개인정보: 비공개 유저는 어디에도 들어가지 않는다

    @Test
    void 비공개_차단_유저의_기록은_채보_집계에_전혀_들어가지_않는다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        record(user(true), chart, "90.00");
        record(user(true), chart, "80.00");
        record(user(false), chart, "100.00");          // 비공개
        record(blockedPublicUser(), chart, "99.00");   // 공개였지만 차단

        ChartAggregateRow row = aggregateOf(chart);

        assertThat(row.players()).isEqualTo(2);                         // 공개 + ACTIVE 둘뿐
        assertThat(row.records()).isEqualTo(2);
        assertThat(row.sumRate()).isEqualByComparingTo("170.00");       // 90 + 80, 비공개 100·차단 99가 섞이면 369가 된다
    }

    @Test
    void 비공개_유저만_기록한_채보는_집계에_아예_나오지_않는다() {
        SongDifficulty onlyPrivate = chart("6.0", PatternType.SINGLE);
        record(user(false), onlyPrivate, "95.00");

        assertThat(aggregates()).extracting(ChartAggregateRow::songDifficultyId).doesNotContain(onlyPrivate.getId());
    }

    @Test
    void 비공개_유저는_채보별_유저_목록에도_나오지_않는다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        User open = user(true);
        record(open, chart, "90.00");
        record(user(false), chart, "100.00");
        record(blockedPublicUser(), chart, "99.00");
        em.flush();
        em.clear();
        sqlSession.clearCache();

        List<ChartPlayerRow> rows = mapper.findPlayerRows(SRN_PLUS, chart.getId(), SINCE);

        assertThat(rows).extracting(ChartPlayerRow::userId).containsExactly(open.getId());
    }

    @Test
    void 공개_유저_수는_비공개_차단_유저를_세지_않는다() {
        user(true);
        user(true);
        user(false);
        blockedPublicUser();
        em.flush();
        em.clear();
        sqlSession.clearCache();

        assertThat(mapper.countPublicUsers()).isEqualTo(2);
    }

    @Test
    void 비공개_유저의_레이팅_후보는_유저_id를_직접_넘겨도_읽히지_않는다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        User open = user(true);
        User closed = user(false);
        record(open, chart, "90.00");
        record(closed, chart, "100.00");
        em.flush();
        em.clear();
        sqlSession.clearCache();

        List<PublicRatingCandidate> rows = skillMapper.findRatingCandidatesForPublicUsers(
                List.of(open.getId(), closed.getId()), SRN_PLUS, table.getId(), PatternType.EXCLUDED.getLabel());

        assertThat(rows).extracting(PublicRatingCandidate::userId).containsExactly(open.getId());
        assertThat(rows.get(0).bestRate()).isEqualByComparingTo("90.00");
    }

    @Test
    void 공개_유저_여러_명의_레이팅_후보가_한_번의_쿼리에_유저_id와_함께_나온다() {
        SongDifficulty a = chart("6.0", PatternType.SINGLE);
        SongDifficulty b = chart("6.5", PatternType.TRIPLE);
        SongDifficulty excluded = chart("6.0", PatternType.EXCLUDED);
        SongDifficulty undecided = chart(null, PatternType.SINGLE);
        User u1 = user(true);
        User u2 = user(true);
        record(u1, a, "90.00");
        record(u1, a, "95.00");     // 같은 채보 두 번 -> 최고 1개
        record(u1, excluded, "99.00");
        record(u1, undecided, "99.00");
        record(u2, b, "88.00");
        em.flush();
        em.clear();
        sqlSession.clearCache();

        List<PublicRatingCandidate> rows = skillMapper.findRatingCandidatesForPublicUsers(
                List.of(u1.getId(), u2.getId()), SRN_PLUS, table.getId(), PatternType.EXCLUDED.getLabel());

        assertThat(rows).hasSize(2);
        assertThat(rows).filteredOn(r -> r.userId().equals(u1.getId())).singleElement()
                .satisfies(r -> assertThat(r.bestRate()).isEqualByComparingTo("95.00"));
        assertThat(rows).filteredOn(r -> r.userId().equals(u2.getId())).singleElement()
                .satisfies(r -> assertThat(r.songDifficultyId()).isEqualTo(b.getId()));
    }

    // ---- 집계 규칙

    @Test
    void 한_유저가_여러_번_저장해도_평균에는_그_유저의_최고_달성률_1개만_들어간다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        User a = user(true);
        User b = user(true);
        record(a, chart, "70.00");
        record(a, chart, "92.00");
        record(a, chart, "85.00");   // a의 최고는 92
        record(b, chart, "80.00");

        ChartAggregateRow row = aggregateOf(chart);

        assertThat(row.players()).isEqualTo(2);                       // 사람 수
        assertThat(row.records()).isEqualTo(4);                       // 저장 횟수
        assertThat(row.sumRate()).isEqualByComparingTo("172.00");     // 92 + 80 (70, 85는 들어가지 않는다)
    }

    @Test
    void SRN_플러스_이외의_옵션_기록은_집계되지_않는다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        User a = user(true);
        record(a, chart, "90.00");
        record(a, chart, NoteOption.NORMAL, "99.00", SINCE.minusDays(30));

        ChartAggregateRow row = aggregateOf(chart);

        assertThat(row.records()).isEqualTo(1);
        assertThat(row.sumRate()).isEqualByComparingTo("90.00");
    }

    @Test
    void 최근_7일_증가분은_시작_시각과_같거나_이후에_저장된_기록만_센다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        User a = user(true);
        record(a, chart, NoteOption.SUPER_RANDOM_PLUS, "80.00", SINCE.minusSeconds(1));   // 1초 전: 제외
        record(a, chart, NoteOption.SUPER_RANDOM_PLUS, "81.00", SINCE);                    // 정확히 시작: 포함
        record(a, chart, NoteOption.SUPER_RANDOM_PLUS, "82.00", SINCE.plusDays(3));        // 포함

        ChartAggregateRow row = aggregateOf(chart);

        assertThat(row.records()).isEqualTo(3);
        assertThat(row.recentRecords()).isEqualTo(2);
    }

    @Test
    void 기준_난이도가_없는_채보와_서열표에_없는_채보는_tier가_null이다() {
        SongDifficulty undecided = chart(null, PatternType.SINGLE);
        SongDifficulty notInTable = chartNotInTable();
        record(user(true), undecided, "90.00");
        record(user(true), notInTable, "90.00");

        List<ChartAggregateRow> rows = aggregates();

        assertThat(rows).filteredOn(r -> r.songDifficultyId().equals(undecided.getId())).singleElement()
                .satisfies(r -> assertThat(r.tier()).isNull());
        assertThat(rows).filteredOn(r -> r.songDifficultyId().equals(notInTable.getId())).singleElement()
                .satisfies(r -> assertThat(r.tier()).isNull());
    }

    @Test
    void 서열표_기준_난이도와_곡_정보가_함께_나온다() {
        SongDifficulty chart = chart("6.4", PatternType.SINGLE);
        record(user(true), chart, "90.00");

        ChartAggregateRow row = aggregateOf(chart);

        assertThat(row.tier()).isEqualByComparingTo("6.4");
        assertThat(row.part()).isEqualTo("GUITAR");
        assertThat(row.difficulty()).isEqualTo("MASTER");
        assertThat(row.title()).startsWith("곡");
    }

    @Test
    void 삭제된_채보는_집계에서_빠진다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        record(user(true), chart, "90.00");
        em.flush();
        em.createNativeQuery("UPDATE song_difficulties SET is_deleted = TRUE WHERE song_difficulty_id = ?1")
                .setParameter(1, chart.getId()).executeUpdate();

        assertThat(aggregates()).extracting(ChartAggregateRow::songDifficultyId).doesNotContain(chart.getId());
        assertThat(mapper.findChartInfo(chart.getId(), table.getId())).isNull();
    }

    @Test
    void 레이팅_서열표가_없으면_모든_채보가_미정이다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        record(user(true), chart, "90.00");
        em.flush();
        em.clear();
        sqlSession.clearCache();

        List<ChartAggregateRow> rows = mapper.findChartAggregates(SRN_PLUS, null, SINCE);

        assertThat(rows).filteredOn(r -> r.songDifficultyId().equals(chart.getId())).singleElement()
                .satisfies(r -> assertThat(r.tier()).isNull());
    }

    // ---- 채보별 유저 줄 · 폴더 채보 수

    @Test
    void 유저_줄은_최고_달성률과_저장_횟수와_마지막_플레이를_담는다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        User a = user(true);
        record(a, chart, "70.00");
        record(a, chart, "92.00");
        em.flush();
        em.clear();
        sqlSession.clearCache();

        List<ChartPlayerRow> rows = mapper.findPlayerRows(SRN_PLUS, chart.getId(), SINCE);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).bestRate()).isEqualByComparingTo("92.00");
        assertThat(rows.get(0).playCount()).isEqualTo(2);
        assertThat(rows.get(0).lastPlayedAt()).isNotNull();
        assertThat(rows.get(0).nickname()).startsWith("nick");
    }

    @Test
    void 공개_유저가_한_명도_기록하지_않은_채보는_유저_줄이_비어_있고_집계에도_나오지_않는다() {
        SongDifficulty chart = chart("6.0", PatternType.SINGLE);
        record(user(false), chart, "95.00");           // 비공개 유저의 기록만 있다
        em.flush();
        em.clear();
        sqlSession.clearCache();

        assertThat(mapper.findPlayerRows(SRN_PLUS, chart.getId(), SINCE)).isEmpty();
        assertThat(aggregates()).extracting(ChartAggregateRow::songDifficultyId).doesNotContain(chart.getId());
        // 채보 정보는 기록과 따로 읽혀서(요약이 0명으로 나오도록) 그대로 있다
        assertThat(mapper.findChartInfo(chart.getId(), table.getId())).isNotNull();
    }

    @Test
    void 폴더별_채보_수는_기록이_없는_채보도_세고_미정과_삭제된_채보는_세지_않는다() {
        chart("6.0", PatternType.SINGLE);
        chart("6.0", PatternType.TRIPLE);
        chart("6.1", PatternType.SINGLE);
        chart(null, PatternType.SINGLE);   // 미정: 폴더가 아니다
        SongDifficulty deleted = chart("6.0", PatternType.SINGLE);
        em.flush();
        em.createNativeQuery("UPDATE song_difficulties SET is_deleted = TRUE WHERE song_difficulty_id = ?1")
                .setParameter(1, deleted.getId()).executeUpdate();
        em.clear();
        sqlSession.clearCache();

        List<FolderChartCountRow> rows = mapper.findFolderChartCounts(table.getId());

        assertThat(rows).hasSize(2);
        assertThat(rows).filteredOn(r -> r.tier().compareTo(new BigDecimal("6.0")) == 0).singleElement()
                .satisfies(r -> assertThat(r.chartCount()).isEqualTo(2));
        assertThat(rows).filteredOn(r -> r.tier().compareTo(new BigDecimal("6.1")) == 0).singleElement()
                .satisfies(r -> assertThat(r.chartCount()).isEqualTo(1));
    }
}
