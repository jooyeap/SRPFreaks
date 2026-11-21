package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 곡 목록 속성 필터가 쓰는 쿼리(채보 id + 속성)를 실제 MySQL에서 확인한다(D85).
 * 속성은 한글 라벨로 저장되는 변환기를 거치므로 단일/복합/이중/삼중/레이팅 제외/NULL이 그대로 돌아오는지 본다. Docker가 필요하다.
 */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class ChartPatternRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired DifficultyTableEntryRepository entryRepository;

    private SongDifficulty chart(User owner, String title, String level) {
        Song song = Song.create(title, "A", "test", owner);
        em.persist(song);
        SongDifficulty d = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal(level));
        em.persist(d);
        return d;
    }

    private void entry(DifficultyTable table, SongDifficulty chart, PatternType pattern) {
        DifficultyTableEntry e = DifficultyTableEntry.create(table, chart);
        e.changePattern(pattern, false);
        em.persist(e);
    }

    @Test
    void 표의_채보별_속성을_라벨_그대로_읽고_다른_표의_항목은_섞이지_않는다() {
        User owner = User.create("sub-pattern-owner", "pattern-owner@example.com", null);
        em.persist(owner);
        DifficultyTable table = DifficultyTable.create("속성 표", null, NoteOption.SUPER_RANDOM_PLUS);
        DifficultyTable otherTable = DifficultyTable.create("다른 표", null, NoteOption.SUPER_RANDOM_PLUS);
        em.persist(table);
        em.persist(otherTable);
        SongDifficulty single = chart(owner, "single", "9.00");
        SongDifficulty compound = chart(owner, "compound", "9.10");
        SongDifficulty excluded = chart(owner, "excluded", "9.20");
        SongDifficulty none = chart(owner, "none", "9.30");
        SongDifficulty elsewhere = chart(owner, "elsewhere", "9.40");
        entry(table, single, PatternType.SINGLE);
        entry(table, compound, PatternType.COMPOUND);
        entry(table, excluded, PatternType.EXCLUDED);
        entry(table, none, null);
        entry(otherTable, elsewhere, PatternType.TRIPLE);
        em.flush();
        em.clear();

        var rows = entryRepository.findChartPatterns(table.getId());

        assertThat(rows).extracting(ChartPattern::songDifficultyId, ChartPattern::patternType).containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple(single.getId(), PatternType.SINGLE),
                org.assertj.core.groups.Tuple.tuple(compound.getId(), PatternType.COMPOUND),
                org.assertj.core.groups.Tuple.tuple(excluded.getId(), PatternType.EXCLUDED),
                org.assertj.core.groups.Tuple.tuple(none.getId(), null));
    }
}
