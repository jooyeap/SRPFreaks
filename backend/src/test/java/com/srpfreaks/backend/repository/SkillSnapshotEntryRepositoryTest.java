package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SkillSnapshot;
import com.srpfreaks.backend.entity.SkillSnapshotEntry;
import com.srpfreaks.backend.entity.SnapshotGroup;
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
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 오늘 기록 갱신(D32 변경)에서 쓰는 "상세 전부 지우고 다시 넣기"를 실제 MySQL에서 확인한다. Docker가 필요하다.
 * 같은 채보를 다시 넣어도 유일 키(uk_skill_snapshot_entries_chart)에 걸리지 않아야 하고, 다른 스냅샷의 상세는 그대로여야 한다.
 */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SkillSnapshotEntryRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired SkillSnapshotEntryRepository entryRepository;
    @Autowired SkillSnapshotRepository snapshotRepository;

    @Test
    void 상세를_지운_뒤_같은_채보를_다시_넣을_수_있고_다른_스냅샷은_그대로다() {
        User user = User.create("sub-snap-entry", "snap-entry@example.com", null);
        em.persist(user);
        Song song = Song.create("Snapshot Song", "Artist", "test", user);
        em.persist(song);
        SongDifficulty chart = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("8.50"));
        em.persist(chart);
        SkillSnapshot yesterday = SkillSnapshot.create(user, NoteOption.SUPER_RANDOM_PLUS, LocalDate.of(2026, 10, 26),
                new BigDecimal("100.00"), new BigDecimal("100.00"), new BigDecimal("0.00"));
        SkillSnapshot today = SkillSnapshot.create(user, NoteOption.SUPER_RANDOM_PLUS, LocalDate.of(2026, 10, 27),
                new BigDecimal("110.00"), new BigDecimal("110.00"), new BigDecimal("0.00"));
        em.persist(yesterday);
        em.persist(today);
        em.persist(entry(yesterday, chart, "90.00"));
        em.persist(entry(today, chart, "92.00"));
        em.flush();

        // 서비스와 같은 순서: 점수 바꾸기 → 상세 지우기 → 같은 채보 다시 넣기
        today.replaceScores(new BigDecimal("120.00"), new BigDecimal("120.00"), new BigDecimal("0.00"));
        entryRepository.deleteAllBySnapshotId(today.getId());
        entryRepository.saveAll(List.of(entry(today, chart, "95.00")));
        em.flush();
        em.clear();

        assertThat(entryRepository.findAllWithChart(today.getId()))
                .singleElement()
                .satisfies(e -> assertThat(e.getAchievementRate()).isEqualByComparingTo("95.00"));
        assertThat(entryRepository.findAllWithChart(yesterday.getId()))
                .singleElement()
                .satisfies(e -> assertThat(e.getAchievementRate()).isEqualByComparingTo("90.00"));
        assertThat(snapshotRepository.findById(today.getId()).orElseThrow().getTotalScore()).isEqualByComparingTo("120.00");
    }

    private static SkillSnapshotEntry entry(SkillSnapshot snapshot, SongDifficulty chart, String rate) {
        return SkillSnapshotEntry.create(snapshot, chart, SnapshotGroup.SINGLE, 1, new BigDecimal(rate), false, new BigDecimal("40.00"));
    }
}
