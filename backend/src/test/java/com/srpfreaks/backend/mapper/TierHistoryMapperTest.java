package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 서열표 변경 이력 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다.
 * 감사 로그는 TableEntryAdminService가 남기는 것과 같은 모양(detail JSON)으로 직접 넣는다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class TierHistoryMapperTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired TierHistoryMapper mapper;

    User actor;
    Song song;
    SongDifficulty guitar;
    SongDifficulty bass;

    @BeforeEach
    void setUp() {
        actor = persist(User.create("sub-th", "th@example.com", null));
        song = persist(Song.create("이력 곡", null, "test", null));
        guitar = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        bass = persist(SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("9.00")));
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private static Map<String, Object> values(String tier, String recommend, String pattern, boolean ratingEnabled) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tier", tier);
        m.put("recommend", recommend);
        m.put("pattern", pattern);
        m.put("ratingEnabled", ratingEnabled);
        return m;
    }

    private void log(String action, SongDifficulty chart, Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("difficultyTableId", 1);
        detail.put("songDifficultyId", chart.getId());
        detail.put("after", after);
        if (before != null) {
            detail.put("before", before);
        }
        persist(AuditLog.record(actor, action, "DIFFICULTY_TABLE_ENTRY", "1", detail));
    }

    private List<TierHistoryRow> history(Long songId) {
        em.flush();
        em.clear();
        return mapper.findBySong(songId, 50, 0);
    }

    @Test
    void 기준_난이도가_바뀐_수정과_추가를_최신순으로_돌려준다() {
        log("TABLE_ENTRY_CREATE", guitar, null, values("9.5", null, "단일", false));
        log("TABLE_ENTRY_UPDATE", guitar, values("9.5", null, "단일", false), values("9.6", null, "단일", false));

        List<TierHistoryRow> rows = history(song.getId());

        assertThat(rows).hasSize(2);
        TierHistoryRow update = rows.get(0);
        assertThat(update.action()).isEqualTo("TABLE_ENTRY_UPDATE");
        assertThat(update.beforeTier()).isEqualTo("9.5");
        assertThat(update.afterTier()).isEqualTo("9.6");
        assertThat(update.part()).isEqualTo("GUITAR");
        assertThat(update.difficulty()).isEqualTo("MASTER");
        assertThat(update.level()).isEqualByComparingTo("9.50");
        assertThat(update.changedAt()).isNotNull();
        TierHistoryRow created = rows.get(1);
        assertThat(created.action()).isEqualTo("TABLE_ENTRY_CREATE");
        assertThat(created.beforeTier()).isNull();
        assertThat(created.afterTier()).isEqualTo("9.5");
        assertThat(created.afterPattern()).isEqualTo("단일");
    }

    @Test
    void 속성만_바뀌어도_보이고_값이_사라진_것도_보인다() {
        log("TABLE_ENTRY_UPDATE", guitar, values("9.5", null, "단일", true), values("9.5", null, "복합", true));
        log("TABLE_ENTRY_UPDATE", bass, values("9.0", null, "단일", true), values(null, null, "단일", true));

        List<TierHistoryRow> rows = history(song.getId());

        assertThat(rows).hasSize(2);
        TierHistoryRow cleared = rows.get(0);   // 나중에 남긴 로그가 먼저
        assertThat(cleared.part()).isEqualTo("BASS");
        assertThat(cleared.beforeTier()).isEqualTo("9.0");
        assertThat(cleared.afterTier()).isNull();   // JSON null은 SQL NULL로 나온다("null" 글자가 아니다)
        assertThat(rows.get(1).beforePattern()).isEqualTo("단일");
        assertThat(rows.get(1).afterPattern()).isEqualTo("복합");
    }

    @Test
    void 추천도나_레이팅_반영만_바뀐_수정은_제외한다() {
        log("TABLE_ENTRY_UPDATE", guitar, values("9.5", "상", "단일", false), values("9.5", "중", "단일", true));

        assertThat(history(song.getId())).isEmpty();
    }

    @Test
    void 값이_없다가_생긴_것도_변경이다() {
        log("TABLE_ENTRY_UPDATE", guitar, values(null, null, null, false), values("9.5", null, "단일", false));

        List<TierHistoryRow> rows = history(song.getId());

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).beforeTier()).isNull();
        assertThat(rows.get(0).afterTier()).isEqualTo("9.5");
    }

    @Test
    void 다른_곡의_로그와_삭제된_채보의_로그와_다른_종류의_로그는_섞이지_않는다() {
        Song other = persist(Song.create("다른 곡", null, "test", null));
        SongDifficulty otherChart = persist(SongDifficulty.create(other, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("8.00")));
        log("TABLE_ENTRY_UPDATE", otherChart, values("8.0", null, "단일", false), values("8.1", null, "단일", false));
        log("SONG_UPDATE", guitar, values("9.5", null, "단일", false), values("9.9", null, "단일", false));
        SongDifficulty removed = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.EXTREME, new BigDecimal("8.50")));
        log("TABLE_ENTRY_UPDATE", removed, values("8.0", null, "단일", false), values("8.2", null, "단일", false));
        removed.delete();

        assertThat(history(song.getId())).isEmpty();
        assertThat(history(other.getId())).hasSize(1);
    }

    @Test
    void 페이지로_나누고_전체_개수를_센다() {
        for (int i = 0; i < 5; i++) {
            log("TABLE_ENTRY_UPDATE", guitar, values("9." + i, null, "단일", false), values("9." + (i + 1), null, "단일", false));
        }
        em.flush();
        em.clear();

        assertThat(mapper.countBySong(song.getId())).isEqualTo(5);
        List<TierHistoryRow> second = mapper.findBySong(song.getId(), 2, 2);
        assertThat(second).hasSize(2);
        // 최신순이므로 3번째·4번째 로그(i=2,1)
        assertThat(second.get(0).beforeTier()).isEqualTo("9.2");
        assertThat(second.get(1).beforeTier()).isEqualTo("9.1");
    }
}
