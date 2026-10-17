package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.SetlistItem;
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
 * 세트리스트 추천 후보 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다.
 * JPA로 데이터를 넣고(flush) 같은 트랜잭션 안에서 MyBatis가 읽는다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SetlistRecommendMapperTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired SetlistRecommendMapper mapper;

    User userA;
    User userB;
    DifficultyTable table;
    DifficultyTable otherTable;
    int songSeq = 0;

    @BeforeEach
    void setUp() {
        userA = persist(User.create("sub-rec-a", "rec-a@example.com", null));
        userB = persist(User.create("sub-rec-b", "rec-b@example.com", null));
        table = persist(DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS));
        otherTable = persist(DifficultyTable.create("다른 표", null, NoteOption.SUPER_RANDOM_PLUS));
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    /** 곡 + 채보 하나를 만들어 서열표(on)에 올린다. tier/pattern이 null이면 해당 값을 비워 둔다. */
    private SongDifficulty chart(DifficultyTable on, String tier, PatternType pattern, boolean ratingEnabled) {
        Song song = persist(Song.create("곡" + (++songSeq), null, "test", null));
        SongDifficulty d = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        DifficultyTableEntry e = DifficultyTableEntry.create(on, d);
        e.changeTier(tier == null ? null : new BigDecimal(tier), false, null);
        e.changePattern(pattern, false);
        e.changeRatingEnabled(ratingEnabled);
        persist(e);
        return d;
    }

    private SongDifficulty chart(String tier) {
        return chart(table, tier, PatternType.SINGLE, true);
    }

    private void record(User user, SongDifficulty d, NoteOption option, String rate, boolean fc) {
        persist(OptionRecord.create(user, d, option, new BigDecimal(rate), fc, null, null, null));
    }

    private List<RecommendCandidate> query(User user, String lo, String hi) {
        em.flush();
        em.clear();
        return mapper.findCandidates(user.getId(), NoteOption.SUPER_RANDOM_PLUS.name(), table.getId(),
                PatternType.EXCLUDED.getLabel(), new BigDecimal(lo), new BigDecimal(hi));
    }

    private static List<Long> ids(List<RecommendCandidate> rows) {
        return rows.stream().map(RecommendCandidate::songDifficultyId).toList();
    }

    @Test
    void 기록이_없는_채보도_후보로_나오고_기록_값은_비어_있다() {
        SongDifficulty d = chart("6.2");

        List<RecommendCandidate> rows = query(userA, "5.7", "6.7");

        assertThat(rows).hasSize(1);
        RecommendCandidate c = rows.get(0);
        assertThat(c.songDifficultyId()).isEqualTo(d.getId());
        assertThat(c.tier()).isEqualByComparingTo("6.2");
        assertThat(c.bestRate()).isNull();
        assertThat(c.fullCombo()).isNull();
        assertThat(c.part()).isEqualTo("GUITAR");
        assertThat(c.difficulty()).isEqualTo("MASTER");
        assertThat(c.level()).isEqualByComparingTo("9.50");
    }

    @Test
    void 채보별_최고_달성률과_FC_여부를_붙인다() {
        SongDifficulty d = chart("6.2");
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "70.00", false);
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "88.50", true);
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "80.00", false);

        RecommendCandidate c = query(userA, "5.7", "6.7").get(0);

        assertThat(c.bestRate()).isEqualByComparingTo("88.50");
        assertThat(c.fullCombo()).isTrue();
    }

    @Test
    void 기준_난이도_범위는_경계를_포함한다() {
        SongDifficulty low = chart("5.7");
        SongDifficulty high = chart("6.7");
        chart("5.6");   // 범위 밖
        chart("6.8");   // 범위 밖

        assertThat(ids(query(userA, "5.7", "6.7"))).containsExactlyInAnyOrder(low.getId(), high.getId());
    }

    @Test
    void 다른_사용자의_기록과_SRN_플러스가_아닌_옵션의_기록은_섞이지_않는다() {
        SongDifficulty d = chart("6.2");
        record(userB, d, NoteOption.SUPER_RANDOM_PLUS, "99.00", false);   // 남의 기록
        record(userA, d, NoteOption.NORMAL, "98.00", false);              // 다른 옵션
        record(userA, d, NoteOption.SUPER_RANDOM_PLUS, "60.00", false);

        RecommendCandidate c = query(userA, "5.7", "6.7").get(0);

        assertThat(c.bestRate()).isEqualByComparingTo("60.00");
    }

    @Test
    void 이미_세트리스트에_담은_채보는_빠지고_남이_담은_것은_영향이_없다() {
        SongDifficulty mine = chart("6.2");
        SongDifficulty others = chart("6.3");
        SongDifficulty free = chart("6.1");
        persist(SetlistItem.create(userA, mine));
        persist(SetlistItem.create(userB, others));   // userB의 세트리스트는 userA의 추천에 영향이 없다

        assertThat(ids(query(userA, "5.7", "6.7"))).containsExactlyInAnyOrder(others.getId(), free.getId());
    }

    @Test
    void 레이팅_대상이_아닌_채보는_빠진다() {
        SongDifficulty ok = chart("6.2");
        chart(table, null, PatternType.SINGLE, true);              // 기준 난이도 없음(미정)
        chart(table, "6.2", null, true);                           // 속성 없음
        chart(table, "6.2", PatternType.EXCLUDED, true);           // 레이팅 제외
        chart(table, "6.2", PatternType.SINGLE, false);            // 레이팅 반영 꺼짐
        chart(otherTable, "6.2", PatternType.SINGLE, true);        // 다른 서열표
        SongDifficulty deletedChart = chart("6.2");
        deletedChart.delete();
        SongDifficulty deletedSong = chart("6.2");
        deletedSong.getSong().delete();

        assertThat(ids(query(userA, "5.7", "6.7"))).containsExactly(ok.getId());
    }
}
