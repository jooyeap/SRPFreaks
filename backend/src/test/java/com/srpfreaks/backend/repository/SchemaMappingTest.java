package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Notice;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Platform;
import com.srpfreaks.backend.entity.Recommend;
import com.srpfreaks.backend.entity.RefreshToken;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.entity.TitleKind;
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
import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 MySQL(Testcontainers)에서 Flyway V1을 적용하고, 엔티티 매핑이 스키마와 맞는지 확인한다.
 * - ddl-auto=validate라서 엔티티와 스키마가 다르면 컨텍스트가 뜨는 단계에서 실패한다. 이 테스트가 통과하는 것 자체가 매핑 검증이다.
 * - 이어서 모든 엔티티를 저장하고 다시 읽어서 값(JSON, 한글 enum, 소수점, 시간)이 보존되는지 본다.
 * Docker가 필요하다.
 */
@DataJpaTest
@Testcontainers
// 임베디드 DB로 바꿔치기하지 않고, 아래 컨테이너의 실제 MySQL을 쓴다
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
// application.yml의 ${DB_PASSWORD}를 테스트에서 풀지 않도록 덮어쓴다 (실제 접속 정보는 @ServiceConnection이 준다)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SchemaMappingTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired
    EntityManager em;

    @Test
    void 시드_데이터가_들어_있다() {
        Number tiers = (Number) em.createNativeQuery("select count(*) from player_tiers").getSingleResult();
        assertThat(tiers.intValue()).isEqualTo(20);

        AppSetting pivot = em.find(AppSetting.class, "rating.pivot");
        assertThat(pivot).isNotNull();
        assertThat(pivot.getValue()).isEqualTo("6.0");
    }

    @Test
    void 모든_엔티티를_저장하고_다시_읽을_수_있다() {
        User user = User.create("google-sub-1", "a@example.com", "tester");
        em.persist(user);

        RefreshToken token = RefreshToken.issue(user, "11111111-1111-1111-1111-111111111111",
                "a".repeat(64), Instant.parse("2026-10-20T00:00:00Z"));
        em.persist(token);

        Song song = Song.create("ネクロファンタジア", "Artist", "test", user);
        em.persist(song);
        em.persist(SongTitle.create(song, TitleKind.ROMAJI, "Necro Fantasia"));

        SongDifficulty difficulty = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.85"));
        em.persist(difficulty);

        OptionRecord record = OptionRecord.create(user, difficulty, NoteOption.SUPER_RANDOM_PLUS,
                new BigDecimal("98.76"), true, Instant.parse("2026-10-05T01:02:03Z"), Platform.ARCADE, "메모");
        record.changeExtraOptions(Map.of("hispeed", "5.5"));
        em.persist(record);

        DifficultyTable table = DifficultyTable.create("테스트 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        em.persist(table);
        DifficultyTableEntry entry = DifficultyTableEntry.create(table, difficulty);
        entry.changeTier(new BigDecimal("6.3"), true, 1);
        entry.changeRecommend(Recommend.HIGH, false);
        entry.changePattern(PatternType.EXCLUDED, true);
        em.persist(entry);

        em.persist(AuditLog.record(user, "SONG_IMPORT", "SONG", String.valueOf(song.getId()), Map.of("count", 1)));
        Notice notice = Notice.create(user, "업데이트 안내", "줄1\n줄2");
        em.persist(notice);

        em.flush();
        em.clear();

        Notice loadedNotice = em.find(Notice.class, notice.getId());
        assertThat(loadedNotice.getTitle()).isEqualTo("업데이트 안내");
        assertThat(loadedNotice.getContent()).isEqualTo("줄1\n줄2");
        assertThat(loadedNotice.getCreatedAt()).isNotNull();

        OptionRecord loaded = em.find(OptionRecord.class, record.getId());
        assertThat(loaded.getAchievementRate()).isEqualByComparingTo("98.76");
        assertThat(loaded.isFullCombo()).isTrue();
        assertThat(loaded.getNoteOption()).isEqualTo(NoteOption.SUPER_RANDOM_PLUS);
        assertThat(loaded.getPlayedAt()).isEqualTo(Instant.parse("2026-10-05T01:02:03Z"));
        assertThat(loaded.getExtraOptions()).containsEntry("hispeed", "5.5");
        assertThat(loaded.getCreatedAt()).isNotNull();
        assertThat(loaded.isOwnedBy(user.getId())).isTrue();

        DifficultyTableEntry loadedEntry = em.find(DifficultyTableEntry.class, entry.getId());
        assertThat(loadedEntry.getTierLabel()).isEqualByComparingTo("6.3");
        assertThat(loadedEntry.getRecommend()).isEqualTo(Recommend.HIGH);
        assertThat(loadedEntry.getPatternType()).isEqualTo(PatternType.EXCLUDED);
        assertThat(loadedEntry.isRatable()).isFalse();

        // DB에는 enum 이름이 아니라 한글 값이 저장되어 있어야 한다
        Object stored = em.createNativeQuery("select pattern_type from difficulty_table_entries where difficulty_table_entry_id = ?1")
                .setParameter(1, entry.getId()).getSingleResult();
        assertThat(stored).isEqualTo("레이팅 제외");
    }
}
