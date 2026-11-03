package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.Platform;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.TierNotification;
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
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 서열표 변경 알림(D61)의 후보 쿼리(TierAlertMapper)와 섞은 알림 목록 쿼리(NotificationMapper)를 실제 MySQL(Flyway 스키마, V20 포함)에서 확인한다.
 * Docker가 필요하다. 감사 로그는 TableEntryAdminService가 남기는 것과 같은 모양(detail JSON)으로 직접 넣는다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class TierAlertMapperTest {

    static final LocalDateTime LONG_AGO = LocalDateTime.of(2000, 1, 1, 0, 0);

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired TierAlertMapper mapper;
    @Autowired NotificationMapper notificationMapper;

    User admin;
    User me;
    User other;
    Song song;
    SongDifficulty guitar;
    SongDifficulty bass;

    @BeforeEach
    void setUp() {
        admin = persist(User.create("sub-admin", "admin@example.com", null));
        me = persist(User.create("sub-me", "me@example.com", null));
        other = persist(User.create("sub-other", "other@example.com", null));
        song = persist(Song.create("알림 곡", null, "test", null));
        guitar = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        bass = persist(SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("9.00")));
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private void record(User user, SongDifficulty chart, String rate) {
        persist(OptionRecord.create(user, chart, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(rate), false,
                Instant.parse("2026-10-01T00:00:00Z"), Platform.ARCADE, null));
    }

    private static Map<String, Object> values(String tier, String recommend, String pattern) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tier", tier);
        m.put("recommend", recommend);
        m.put("pattern", pattern);
        m.put("ratingEnabled", true);
        return m;
    }

    private AuditLog log(String action, SongDifficulty chart, Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("difficultyTableId", 1);
        detail.put("songDifficultyId", chart.getId());
        detail.put("after", after);
        if (before != null) {
            detail.put("before", before);
        }
        return persist(AuditLog.record(admin, action, "DIFFICULTY_TABLE_ENTRY", "1", detail));
    }

    private List<TierAlertRow> changes(long afterId) {
        em.flush();
        em.clear();
        return mapper.findChanges(me.getId(), "SUPER_RANDOM_PLUS", afterId, mapper.maxAuditLogId(), LONG_AGO);
    }

    @Test
    void 내가_기록한_채보의_기준_난이도_변경만_최고_달성률과_함께_돌려준다() {
        record(me, guitar, "88.00");
        record(me, guitar, "91.50");
        record(other, bass, "99.00");   // 남의 기록만 있는 채보
        log("TABLE_ENTRY_UPDATE", guitar, values("6.5", null, "단일"), values("6.8", null, "단일"));
        log("TABLE_ENTRY_UPDATE", bass, values("6.0", null, "단일"), values("6.2", null, "단일"));

        List<TierAlertRow> rows = changes(0);

        assertThat(rows).hasSize(1);
        TierAlertRow row = rows.get(0);
        assertThat(row.songDifficultyId()).isEqualTo(guitar.getId());
        assertThat(row.beforeTier()).isEqualTo("6.5");
        assertThat(row.afterTier()).isEqualTo("6.8");
        assertThat(row.myRate()).isEqualByComparingTo("91.50");
    }

    @Test
    void 속성_추천만_바뀐_로그는_뺀다() {
        record(me, guitar, "90.00");
        log("TABLE_ENTRY_UPDATE", guitar, values("6.5", null, "단일"), values("6.5", "상", "복합"));

        assertThat(changes(0)).isEmpty();
    }

    @Test
    void 미정과_값_사이의_변경과_새_줄은_잡고_값_없는_새_줄은_뺀다() {
        record(me, guitar, "90.00");
        record(me, bass, "90.00");
        log("TABLE_ENTRY_UPDATE", guitar, values("6.5", null, "단일"), values(null, null, "단일"));
        log("TABLE_ENTRY_CREATE", bass, null, values("7.0", null, "단일"));
        log("TABLE_ENTRY_CREATE", guitar, null, values(null, null, "단일"));

        List<TierAlertRow> rows = changes(0);

        assertThat(rows).extracting(TierAlertRow::afterTier).containsExactly(null, "7.0");
        assertThat(rows.get(1).beforeTier()).isNull();
    }

    @Test
    void 커서_이후의_로그만_로그_번호_순으로_읽는다() {
        record(me, guitar, "90.00");
        AuditLog first = log("TABLE_ENTRY_UPDATE", guitar, values("6.5", null, "단일"), values("6.6", null, "단일"));
        log("TABLE_ENTRY_UPDATE", guitar, values("6.6", null, "단일"), values("6.7", null, "단일"));
        log("TABLE_ENTRY_UPDATE", guitar, values("6.7", null, "단일"), values("6.8", null, "단일"));
        em.flush();

        List<TierAlertRow> rows = changes(first.getId());

        assertThat(rows).extracting(TierAlertRow::afterTier).containsExactly("6.7", "6.8");
    }

    @Test
    void 삭제된_채보의_로그는_뺀다() {
        record(me, guitar, "90.00");
        log("TABLE_ENTRY_UPDATE", guitar, values("6.5", null, "단일"), values("6.8", null, "단일"));
        guitar.delete();

        assertThat(changes(0)).isEmpty();
    }

    @Test
    void 보관_기간보다_오래된_변경은_뺀다() {
        record(me, guitar, "90.00");
        log("TABLE_ENTRY_UPDATE", guitar, values("6.5", null, "단일"), values("6.8", null, "단일"));
        em.flush();
        em.clear();

        List<TierAlertRow> rows = mapper.findChanges(me.getId(), "SUPER_RANDOM_PLUS", 0, mapper.maxAuditLogId(),
                LocalDateTime.of(2999, 1, 1, 0, 0));

        assertThat(rows).isEmpty();
    }

    @Test
    void 섞은_알림_목록은_두_종류를_시각_최신순으로_나의_것만_돌려준다() {
        Instant t1 = Instant.parse("2026-11-01T00:00:00Z");
        Instant t2 = Instant.parse("2026-11-01T01:00:00Z");
        Instant t3 = Instant.parse("2026-11-01T02:00:00Z");
        TierNotification oldTier = persist(TierNotification.single(me, guitar, new BigDecimal("6.5"), new BigDecimal("6.8"),
                new BigDecimal("90.00"), t1, t1));
        RivalNotification rival = RivalNotification.pending(me, other, bass, new BigDecimal("95.00"), new BigDecimal("94.00"), t2, t2);
        rival.show(new BigDecimal("95.00"), new BigDecimal("94.00"), java.time.LocalDate.of(2026, 11, 1));
        persist(rival);
        RivalNotification pending = persist(RivalNotification.pending(me, other, guitar, new BigDecimal("95.00"),
                new BigDecimal("94.00"), t3, t3));   // 아직 안 보인 줄은 목록에 없다
        TierNotification newTier = persist(TierNotification.single(me, bass, null, new BigDecimal("7.0"),
                new BigDecimal("80.00"), t3, t3));
        persist(TierNotification.single(other, bass, null, new BigDecimal("7.0"), new BigDecimal("80.00"), t3, t3));   // 남의 알림
        em.flush();
        em.clear();

        List<NotificationKey> page = notificationMapper.findPage(me.getId(), 10, 0);

        assertThat(page).containsExactly(
                new NotificationKey("TIER", newTier.getId()),
                new NotificationKey("RIVAL", rival.getId()),
                new NotificationKey("TIER", oldTier.getId()));
        assertThat(page).doesNotContain(new NotificationKey("RIVAL", pending.getId()));
        assertThat(notificationMapper.countAll(me.getId())).isEqualTo(3);
        assertThat(notificationMapper.findPage(me.getId(), 2, 2)).containsExactly(new NotificationKey("TIER", oldTier.getId()));
    }
}
