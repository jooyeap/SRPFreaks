package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
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
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 곡별 순위(D74) 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다(CI에서만 돈다).
 * 동점 규칙이 created_at(서버 저장 시각)에 달려 있어서, 시각이 필요한 테스트는 저장 뒤에 created_at을 직접 정해 둔다
 * (엔티티는 저장 시각을 스스로 채우고 고칠 수 없다). 순서·번호만 보는 테스트는 시각이 달라도 결과가 같게 썼다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SongRankingMapperTest {

    static final String SRN_PLUS = NoteOption.SUPER_RANDOM_PLUS.name();
    static final LocalDateTime DAY1 = LocalDateTime.of(2026, 11, 1, 10, 0);
    static final LocalDateTime DAY2 = DAY1.plusDays(1);
    static final LocalDateTime DAY3 = DAY1.plusDays(2);
    static final LocalDateTime DAY5 = DAY1.plusDays(4);

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired SongRankingMapper mapper;
    @Autowired SqlSessionTemplate sqlSession;

    SongDifficulty chart;
    int seq = 0;

    @BeforeEach
    void setUp() {
        chart = chart(InstrumentPart.GUITAR);
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private SongDifficulty chart(InstrumentPart part) {
        Song song = persist(Song.create("곡" + (++seq), null, "test", null));
        return persist(SongDifficulty.create(song, part, DifficultyType.MASTER, new BigDecimal("9.50")));
    }

    private User user(boolean publicProfile) {
        int n = ++seq;
        User u = User.create("sub-u" + n, "u" + n + "@example.com", "nick" + n);
        if (publicProfile) {
            u.changeProfilePublic(true);
        }
        return persist(u);
    }

    /** 기록 한 줄을 만들고 created_at을 정한다. */
    private OptionRecord record(User user, SongDifficulty d, NoteOption option, String rate, boolean fc, LocalDateTime createdAt) {
        OptionRecord r = persist(OptionRecord.create(user, d, option, new BigDecimal(rate), fc, null, null, null));
        em.flush();
        em.createNativeQuery("UPDATE option_records SET created_at = ?1 WHERE option_record_id = ?2")
                .setParameter(1, createdAt).setParameter(2, r.getId()).executeUpdate();
        return r;
    }

    private OptionRecord record(User user, String rate, LocalDateTime createdAt) {
        return record(user, chart, NoteOption.SUPER_RANDOM_PLUS, rate, false, createdAt);
    }

    private List<RankingRow> page(int limit, long offset) {
        em.flush();
        em.clear();
        // MyBatis는 한 트랜잭션(=한 SqlSession) 안에서 같은 SQL·같은 파라미터의 결과를 캐시한다(1차 캐시).
        // 테스트는 트랜잭션 하나 안에서 데이터를 바꿔 가며 같은 쿼리를 다시 부르므로 캐시를 비워야 바뀐 값이 보인다.
        // 운영에서는 요청마다 새 트랜잭션이라 요청 사이에 낡은 결과가 남지 않고, 한 요청 안에서는 같은 쿼리 사이에 쓰기가 없다.
        sqlSession.clearCache();
        return mapper.findPage(chart.getId(), SRN_PLUS, limit, offset);
    }

    private List<RankingRow> all() {
        return page(50, 0);
    }

    private List<Long> ids(List<RankingRow> rows) {
        return rows.stream().map(RankingRow::userId).toList();
    }

    // ------------------------------------------------------------ 누가 나오는가 (개인정보)

    @Test
    void 공개한_ACTIVE_유저만_나오고_비공개_차단_기록_없는_유저는_인원에도_없다() {
        User open = user(true);
        User hidden = user(false);          // 비공개
        User blocked = user(true);
        blocked.block();                    // 차단(D46)
        User noRecord = user(true);         // 기록 없음
        record(open, "90.00", DAY1);
        record(hidden, "99.00", DAY1);
        record(blocked, "98.00", DAY1);

        assertThat(ids(all())).containsExactly(open.getId());
        assertThat(mapper.countPlayers(chart.getId(), SRN_PLUS)).isEqualTo(1);   // 비공개·차단 유저는 인원에도 세지 않는다
        assertThat(ids(all())).doesNotContain(noRecord.getId());
    }

    @Test
    void 공개_유저가_1명이어도_순위가_나온다_인원_기준이_없다() {
        User only = user(true);
        record(only, "55.00", DAY1);

        List<RankingRow> rows = all();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).nickname()).isEqualTo(only.getNickname());
        assertThat(mapper.countPlayers(chart.getId(), SRN_PLUS)).isEqualTo(1);
    }

    @Test
    void 공개_유저가_없으면_빈_목록이고_인원은_0이다() {
        record(user(false), "99.00", DAY1);

        assertThat(all()).isEmpty();
        assertThat(mapper.countPlayers(chart.getId(), SRN_PLUS)).isZero();
    }

    @Test
    void 공개를_끄면_바로_빠지고_다시_켜면_돌아온다() {
        User u = user(true);
        record(u, "90.00", DAY1);
        assertThat(ids(all())).containsExactly(u.getId());   // all()은 영속성 컨텍스트를 비우므로 아래에서는 다시 읽은 엔티티를 고친다

        User managed = em.find(User.class, u.getId());
        managed.changeProfilePublic(false);
        assertThat(all()).isEmpty();

        managed = em.find(User.class, u.getId());
        managed.changeProfilePublic(true);
        assertThat(ids(all())).containsExactly(u.getId());
    }

    @Test
    void 탈퇴한_유저는_기록이_함께_지워져_자동으로_빠진다() {
        User stays = user(true);
        User leaves = user(true);
        record(stays, "80.00", DAY1);
        record(leaves, "99.00", DAY1);
        em.flush();

        // 탈퇴(D20): 사용자를 지우면 option_records.user_id의 ON DELETE CASCADE로 기록도 함께 지워진다
        em.createNativeQuery("DELETE FROM users WHERE user_id = ?1").setParameter(1, leaves.getId()).executeUpdate();

        assertThat(ids(all())).containsExactly(stays.getId());
        assertThat(mapper.countPlayers(chart.getId(), SRN_PLUS)).isEqualTo(1);
    }

    // ------------------------------------------------------------ 어떤 기록을 쓰는가

    @Test
    void 유저당_최고_달성률_한_줄만_쓴다() {
        User u = user(true);
        record(u, "70.00", DAY1);
        record(u, "90.00", DAY2);
        record(u, "80.00", DAY3);

        List<RankingRow> rows = all();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).bestRate()).isEqualByComparingTo("90.00");
        assertThat(mapper.countPlayers(chart.getId(), SRN_PLUS)).isEqualTo(1);   // 기록이 여러 줄이어도 유저는 1명
    }

    @Test
    void SRN_플러스가_아닌_옵션의_기록은_무시한다() {
        User u = user(true);
        record(u, chart, NoteOption.RANDOM, "99.00", false, DAY1);
        record(u, chart, NoteOption.SUPER_RANDOM_PLUS, "60.00", false, DAY1);
        User onlyOther = user(true);
        record(onlyOther, chart, NoteOption.NORMAL, "99.00", false, DAY1);

        List<RankingRow> rows = all();
        assertThat(ids(rows)).containsExactly(u.getId());              // SRN+ 기록이 없는 유저는 순위에 없다
        assertThat(rows.get(0).bestRate()).isEqualByComparingTo("60.00");
    }

    @Test
    void 다른_채보의_기록은_섞이지_않고_Guitar와_Bass도_따로다() {
        SongDifficulty bass = chart(InstrumentPart.BASS);   // 같은 곡이 아니어도 채보 id가 다르면 따로다
        User u = user(true);
        record(u, chart, NoteOption.SUPER_RANDOM_PLUS, "70.00", false, DAY1);
        record(u, bass, NoteOption.SUPER_RANDOM_PLUS, "99.00", false, DAY1);
        User bassOnly = user(true);
        record(bassOnly, bass, NoteOption.SUPER_RANDOM_PLUS, "50.00", false, DAY1);
        em.flush();
        em.clear();

        assertThat(ids(mapper.findPage(chart.getId(), SRN_PLUS, 50, 0))).containsExactly(u.getId());
        assertThat(mapper.findPage(chart.getId(), SRN_PLUS, 50, 0).get(0).bestRate()).isEqualByComparingTo("70.00");
        assertThat(ids(mapper.findPage(bass.getId(), SRN_PLUS, 50, 0))).containsExactly(u.getId(), bassOnly.getId());
        assertThat(mapper.countPlayers(bass.getId(), SRN_PLUS)).isEqualTo(2);
    }

    @Test
    void FC는_하나라도_FC_기록이_있으면_켜진다() {
        User u = user(true);
        record(u, chart, NoteOption.SUPER_RANDOM_PLUS, "90.00", false, DAY1);
        record(u, chart, NoteOption.SUPER_RANDOM_PLUS, "85.00", true, DAY2);
        User plain = user(true);
        record(plain, "80.00", DAY1);

        List<RankingRow> rows = all();
        assertThat(rows.get(0).fullCombo()).isTrue();
        assertThat(rows.get(1).fullCombo()).isFalse();
    }

    // ------------------------------------------------------------ 정렬과 동점

    @Test
    void 달성률_내림차순이다() {
        User low = user(true);
        User high = user(true);
        User mid = user(true);
        record(low, "60.00", DAY1);
        record(high, "99.50", DAY1);
        record(mid, "80.25", DAY1);

        assertThat(ids(all())).containsExactly(high.getId(), mid.getId(), low.getId());
    }

    @Test
    void 동점이면_그_달성률을_먼저_저장한_사람이_위다() {
        User late = user(true);
        User early = user(true);
        record(late, "95.00", DAY3);
        record(early, "95.00", DAY1);

        assertThat(ids(all())).containsExactly(early.getId(), late.getId());
    }

    @Test
    void 같은_시각까지_같으면_user_id가_작은_쪽이_위다() {
        User first = user(true);
        User second = user(true);
        record(second, "95.00", DAY1);
        record(first, "95.00", DAY1);

        assertThat(ids(all())).containsExactly(first.getId(), second.getId());   // first가 먼저 만들어져 id가 작다
    }

    @Test
    void 같은_최고_달성률_기록이_여러_줄이면_가장_이른_created_at을_쓴다() {
        User a = user(true);
        User b = user(true);
        record(a, "95.00", DAY5);
        record(a, "95.00", DAY1);   // a의 가장 이른 최고 기록 = DAY1
        record(b, "95.00", DAY3);

        // a는 95.00을 DAY1에 처음 저장했으므로 DAY3의 b보다 위
        assertThat(ids(all())).containsExactly(a.getId(), b.getId());
        assertThat(all().get(0).achievedAt()).isEqualTo(DAY1);
    }

    @Test
    void 동점_기준은_created_at이고_played_at이_아니다() {
        User realFirst = user(true);
        User fakeEarly = user(true);
        record(realFirst, "95.00", DAY1);
        OptionRecord fake = record(fakeEarly, "95.00", DAY3);
        em.flush();
        // fakeEarly가 played_at을 아주 옛날로 고쳐도(사용자가 할 수 있다) 순위에는 영향이 없다
        em.createNativeQuery("UPDATE option_records SET played_at = ?1 WHERE option_record_id = ?2")
                .setParameter(1, LocalDateTime.of(2020, 1, 1, 0, 0)).setParameter(2, fake.getId()).executeUpdate();

        assertThat(ids(all())).containsExactly(realFirst.getId(), fakeEarly.getId());
    }

    @Test
    void 한계_수정으로_올린_기록은_처음_만든_시각이_쓰인다_D74_가() {
        // 감수하기로 결정한 한계를 고정해 두는 테스트: 기록을 수정(UPDATE)해 달성률을 올리면 created_at은 그대로(처음 만든 시각)다.
        User editor = user(true);
        User direct = user(true);
        OptionRecord old = record(editor, "0.00", DAY1);     // 1일차에 0.00으로 만들어 두고
        record(direct, "100.00", DAY3);                      // 3일차에 다른 유저가 100.00을 입력
        em.flush();
        em.createNativeQuery("UPDATE option_records SET achievement_rate = 100.00 WHERE option_record_id = ?1")
                .setParameter(1, old.getId()).executeUpdate();   // 5일차에 수정(created_at은 건드리지 않는다)

        List<RankingRow> rows = all();
        assertThat(ids(rows)).containsExactly(editor.getId(), direct.getId());   // 수정한 쪽이 created_at이 이르므로 위에 선다
        assertThat(rows.get(0).achievedAt()).isEqualTo(DAY1);
    }

    // ------------------------------------------------------------ 순위 번호와 비공개 유저

    @Test
    void 비공개_유저가_사이에_있어도_순위가_건너뛰지_않는다() {
        User top = user(true);
        User hiddenBetween = user(false);
        User third = user(true);
        record(top, "99.00", DAY1);
        record(hiddenBetween, "98.00", DAY1);   // 99와 97 사이의 비공개 유저
        record(third, "97.00", DAY1);
        em.flush();
        em.clear();

        List<RankingRow> rows = mapper.findPage(chart.getId(), SRN_PLUS, 50, 0);
        assertThat(ids(rows)).containsExactly(top.getId(), third.getId());

        // third의 앞 사람 수 = 1명(비공개 유저는 세지 않는다) -> 2위. 비공개 유저 때문에 3위가 되지 않는다
        RankingRow thirdRow = mapper.findMine(chart.getId(), SRN_PLUS, third.getId());
        assertThat(mapper.countAhead(chart.getId(), SRN_PLUS, thirdRow.bestRate(), thirdRow.achievedAt(), third.getId())).isEqualTo(1);
        assertThat(mapper.countPlayers(chart.getId(), SRN_PLUS)).isEqualTo(2);   // 인원에도 비공개 유저가 없다
    }

    // ------------------------------------------------------------ 페이지

    @Test
    void 페이지는_순서를_유지하며_경계에서_끊긴다() {
        User u1 = user(true);
        User u2 = user(true);
        User u3 = user(true);
        User u4 = user(true);
        User u5 = user(true);
        record(u1, "100.00", DAY1);
        record(u2, "90.00", DAY1);
        record(u3, "80.00", DAY1);
        record(u4, "70.00", DAY1);
        record(u5, "60.00", DAY1);

        assertThat(ids(page(2, 0))).containsExactly(u1.getId(), u2.getId());
        assertThat(ids(page(2, 2))).containsExactly(u3.getId(), u4.getId());
        assertThat(ids(page(2, 4))).containsExactly(u5.getId());     // 마지막 페이지(1줄)
        assertThat(page(2, 6)).isEmpty();                            // 범위 밖 페이지는 빈 목록
        assertThat(mapper.countPlayers(chart.getId(), SRN_PLUS)).isEqualTo(5);
    }

    // ------------------------------------------------------------ 내 줄과 내 순위

    @Test
    void 공개한_나는_내_줄과_앞_사람_수가_나온다() {
        User a = user(true);
        User me = user(true);
        User c = user(true);
        record(a, "99.00", DAY1);
        record(me, "90.00", DAY1);
        record(c, "80.00", DAY1);
        em.flush();
        em.clear();

        RankingRow mine = mapper.findMine(chart.getId(), SRN_PLUS, me.getId());
        assertThat(mine.bestRate()).isEqualByComparingTo("90.00");
        assertThat(mapper.countAhead(chart.getId(), SRN_PLUS, mine.bestRate(), mine.achievedAt(), me.getId())).isEqualTo(1);   // 순위 2위
    }

    @Test
    void 비공개인_나는_내_줄이_없다() {
        User me = user(false);
        record(me, "99.00", DAY1);
        em.flush();
        em.clear();

        assertThat(mapper.findMine(chart.getId(), SRN_PLUS, me.getId())).isNull();   // 비공개 유저의 달성률은 어떤 쿼리로도 나오지 않는다
    }

    @Test
    void 기록이_없는_나는_내_줄이_없다() {
        User me = user(true);
        record(user(true), "90.00", DAY1);
        em.flush();
        em.clear();

        assertThat(mapper.findMine(chart.getId(), SRN_PLUS, me.getId())).isNull();
    }

    @Test
    void 동점인_앞_사람은_먼저_저장한_사람_또는_user_id가_작은_사람만_센다() {
        User early = user(true);
        User me = user(true);
        User late = user(true);
        record(early, "95.00", DAY1);
        record(me, "95.00", DAY2);
        record(late, "95.00", DAY3);
        em.flush();
        em.clear();

        RankingRow mine = mapper.findMine(chart.getId(), SRN_PLUS, me.getId());
        // 같은 달성률 중 나보다 먼저 저장한 early 한 명만 앞이다 -> 2위
        assertThat(mapper.countAhead(chart.getId(), SRN_PLUS, mine.bestRate(), mine.achievedAt(), me.getId())).isEqualTo(1);
        // 목록의 순서와 내 앞 사람 수가 같은 기준이다
        assertThat(ids(mapper.findPage(chart.getId(), SRN_PLUS, 50, 0))).containsExactly(early.getId(), me.getId(), late.getId());
    }
}
