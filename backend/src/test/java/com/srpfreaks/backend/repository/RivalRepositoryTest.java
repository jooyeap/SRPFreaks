package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.Platform;
import com.srpfreaks.backend.entity.Rival;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.RivalNotificationStatus;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 라이벌(D56) 쿼리를 실제 MySQL에서 확인한다(V19 스키마·기본 설정 포함). Docker가 필요하다. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class RivalRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired RivalRepository rivalRepository;
    @Autowired RivalNotificationRepository notificationRepository;
    @Autowired OptionRecordRepository optionRecordRepository;
    @Autowired AppSettingRepository settingRepository;

    static final Instant NOW = Instant.parse("2026-10-31T06:00:00Z");

    User a;
    User b;
    User c;
    SongDifficulty alive;
    SongDifficulty ofDeletedSong;

    @BeforeEach
    void setUp() {
        a = User.create("sub-rival-a", "a-rival@example.com", "A");
        b = User.create("sub-rival-b", "b-rival@example.com", "B");
        c = User.create("sub-rival-c", "c-rival@example.com", "C");
        em.persist(a);
        em.persist(b);
        em.persist(c);
        Song song = Song.create("라이벌 곡", "X", "test", a);
        em.persist(song);
        alive = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        em.persist(alive);
        Song deleted = Song.create("지운 라이벌 곡", "X", "test", a);
        em.persist(deleted);
        ofDeletedSong = SongDifficulty.create(deleted, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.00"));
        em.persist(ofDeletedSong);
        deleted.delete();
        em.flush();
    }

    private void record(User user, SongDifficulty chart, String rate) {
        em.persist(OptionRecord.create(user, chart, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(rate), false,
                Instant.parse("2026-10-01T00:00:00Z"), Platform.ARCADE, null));
    }

    @Test
    void 서로_등록한_사람만_서로_라이벌이다() {
        rivalRepository.save(Rival.of(a, b, NOW));
        rivalRepository.save(Rival.of(b, a, NOW));
        rivalRepository.save(Rival.of(a, c, NOW));   // c는 a를 등록하지 않음
        em.flush();
        em.clear();

        assertThat(rivalRepository.findMutualTargets(a.getId())).extracting(User::getId).containsExactly(b.getId());
        assertThat(rivalRepository.findUserIdsRegistering(a.getId())).containsExactly(b.getId());
        assertThat(rivalRepository.findWithTargetByUserId(a.getId())).hasSize(2);
        assertThat(rivalRepository.countByUser_Id(a.getId())).isEqualTo(2);
    }

    @Test
    void 같은_상대를_두_번_등록할_수_없다() {
        rivalRepository.saveAndFlush(Rival.of(a, b, NOW));
        assertThatThrownBy(() -> rivalRepository.saveAndFlush(Rival.of(a, b, NOW)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 해제하면_한_방향만_지운다() {
        rivalRepository.save(Rival.of(a, b, NOW));
        rivalRepository.save(Rival.of(b, a, NOW));
        em.flush();
        assertThat(rivalRepository.deleteByUserAndTarget(a.getId(), b.getId())).isEqualTo(1);
        assertThat(rivalRepository.existsByUser_IdAndTarget_Id(b.getId(), a.getId())).isTrue();
    }

    @Test
    void 채보별_최고_기록은_삭제된_곡을_빼고_여러_사람을_한_번에_읽는다() {
        record(a, alive, "90.00");
        record(a, alive, "95.50");
        record(a, ofDeletedSong, "99.00");
        record(b, alive, "96.10");
        em.flush();

        List<ChartBest> bests = optionRecordRepository.findActiveBestByUser(a.getId(), NoteOption.SUPER_RANDOM_PLUS);
        assertThat(bests).hasSize(1);
        assertThat(bests.get(0).bestRate()).isEqualByComparingTo("95.50");
        assertThat(bests.get(0).level()).isEqualByComparingTo("9.50");

        assertThat(optionRecordRepository.findBestRate(a.getId(), alive.getId(), NoteOption.SUPER_RANDOM_PLUS))
                .isEqualByComparingTo("95.50");
        assertThat(optionRecordRepository.findBestRate(c.getId(), alive.getId(), NoteOption.SUPER_RANDOM_PLUS)).isNull();
        assertThat(optionRecordRepository.findBestRatesForUsers(alive.getId(), NoteOption.SUPER_RANDOM_PLUS,
                List.of(a.getId(), b.getId(), c.getId()))).extracting(UserBest::userId)
                .containsExactlyInAnyOrder(a.getId(), b.getId());
    }

    @Test
    void 알림_개수와_목록과_보관_기간() {
        LocalDate day = LocalDate.of(2026, 10, 31);
        RivalNotification shown = RivalNotification.pending(b, a, alive, new BigDecimal("96.40"), new BigDecimal("96.10"),
                NOW.minusSeconds(60), NOW.minusSeconds(660));
        shown.show(new BigDecimal("96.40"), new BigDecimal("96.10"), day);
        RivalNotification due = RivalNotification.pending(b, a, alive, new BigDecimal("97.00"), new BigDecimal("96.10"),
                NOW.minusSeconds(1), NOW.minusSeconds(601));
        RivalNotification later = RivalNotification.pending(b, a, alive, new BigDecimal("97.00"), new BigDecimal("96.10"),
                NOW.plusSeconds(300), NOW.minusSeconds(300));
        RivalNotification old = RivalNotification.pending(b, a, alive, new BigDecimal("97.00"), new BigDecimal("96.10"),
                NOW.minusSeconds(31L * 86400), NOW.minusSeconds(31L * 86400));
        notificationRepository.saveAll(List.of(shown, due, later, old));
        em.flush();

        assertThat(notificationRepository.findDue(b.getId(), NOW)).extracting(RivalNotification::getId)
                .containsExactly(old.getId(), due.getId());
        assertThat(notificationRepository.countByRecipient_IdAndActor_IdAndAlertDateAndBundledFalseAndStatus(
                b.getId(), a.getId(), day, RivalNotificationStatus.SHOWN)).isEqualTo(1);
        assertThat(notificationRepository.countByRecipient_IdAndStatusAndReadAtIsNull(b.getId(), RivalNotificationStatus.SHOWN))
                .isEqualTo(1);
        assertThat(notificationRepository.findByRecipient_IdAndStatus(b.getId(), RivalNotificationStatus.SHOWN,
                PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "visibleAt"))).getContent()).hasSize(1);

        assertThat(notificationRepository.markAllRead(b.getId(), NOW)).isEqualTo(1);
        assertThat(notificationRepository.deleteOlderThan(NOW.minusSeconds(30L * 86400))).isEqualTo(1);
    }

    @Test
    void 기본_설정과_알림_받기_기본값() {
        assertThat(settingRepository.findById("rival.max_count")).get().extracting(AppSetting::getValue).isEqualTo("5");
        assertThat(settingRepository.findById("rival.notify_delay_minutes")).get().extracting(AppSetting::getValue).isEqualTo("10");
        assertThat(settingRepository.findById("rival.notify_daily_per_rival")).get().extracting(AppSetting::getValue).isEqualTo("3");
        assertThat(settingRepository.findById("rival.notify_keep_days")).get().extracting(AppSetting::getValue).isEqualTo("30");
        em.clear();
        assertThat(em.find(User.class, a.getId()).isRivalNotify()).isTrue();
    }
}
