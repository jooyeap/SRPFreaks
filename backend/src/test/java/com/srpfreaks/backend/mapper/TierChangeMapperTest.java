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
 * 사이트 전체 서열표 변경 목록(D58) 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다.
 * 감사 로그는 TableEntryAdminService가 남기는 것과 같은 모양(detail JSON)으로 직접 넣는다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class TierChangeMapperTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired TierChangeMapper mapper;

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

    private List<TierChangeRow> changes() {
        em.flush();
        em.clear();
        return mapper.findAll(50, 0);
    }

    @Test
    void 곡_구분_없이_최신순으로_곡명과_함께_돌려준다() {
        Song other = persist(Song.create("다른 곡", null, "test", null));
        SongDifficulty otherChart = persist(SongDifficulty.create(other, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("8.00")));
        log("TABLE_ENTRY_CREATE", guitar, null, values("9.5", "상", "단일", true));
        log("TABLE_ENTRY_UPDATE", otherChart, values("8.0", null, "단일", true), values("8.1", null, "단일", true));

        List<TierChangeRow> rows = changes();

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).title()).isEqualTo("다른 곡");
        assertThat(rows.get(0).songId()).isEqualTo(other.getId());
        assertThat(rows.get(0).beforeTier()).isEqualTo("8.0");
        assertThat(rows.get(0).afterTier()).isEqualTo("8.1");
        assertThat(rows.get(1).action()).isEqualTo("TABLE_ENTRY_CREATE");
        assertThat(rows.get(1).title()).isEqualTo("이력 곡");
        assertThat(rows.get(1).afterRecommend()).isEqualTo("상");
        assertThat(rows.get(1).part()).isEqualTo("GUITAR");
    }

    @Test
    void 추천도만_바뀐_수정도_보이고_레이팅_반영만_바뀐_수정은_뺀다() {
        log("TABLE_ENTRY_UPDATE", guitar, values("9.5", "중", "단일", true), values("9.5", "상", "단일", true));
        log("TABLE_ENTRY_UPDATE", bass, values("9.0", "상", "단일", false), values("9.0", "상", "단일", true));

        List<TierChangeRow> rows = changes();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).beforeRecommend()).isEqualTo("중");
        assertThat(rows.get(0).afterRecommend()).isEqualTo("상");
    }

    @Test
    void 삭제된_곡과_채보와_다른_종류의_로그는_보이지_않는다() {
        log("SONG_UPDATE", guitar, values("9.5", null, "단일", false), values("9.9", null, "단일", false));
        SongDifficulty removed = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.EXTREME, new BigDecimal("8.50")));
        log("TABLE_ENTRY_UPDATE", removed, values("8.0", null, "단일", false), values("8.2", null, "단일", false));
        removed.delete();
        Song gone = persist(Song.create("지운 곡", null, "test", null));
        SongDifficulty goneChart = persist(SongDifficulty.create(gone, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("7.00")));
        log("TABLE_ENTRY_UPDATE", goneChart, values("7.0", null, "단일", false), values("7.1", null, "단일", false));
        gone.delete();

        assertThat(changes()).isEmpty();
        assertThat(mapper.countAll()).isZero();
    }

    @Test
    void 페이지로_나누고_전체_개수를_센다() {
        for (int i = 0; i < 5; i++) {
            log("TABLE_ENTRY_UPDATE", guitar, values("9." + i, null, "단일", false), values("9." + (i + 1), null, "단일", false));
        }
        em.flush();
        em.clear();

        assertThat(mapper.countAll()).isEqualTo(5);
        List<TierChangeRow> second = mapper.findAll(2, 2);
        assertThat(second).hasSize(2);
        assertThat(second.get(0).beforeTier()).isEqualTo("9.2");
        assertThat(second.get(1).beforeTier()).isEqualTo("9.1");
    }
}
