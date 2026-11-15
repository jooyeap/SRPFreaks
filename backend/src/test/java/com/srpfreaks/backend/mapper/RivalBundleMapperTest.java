package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.RivalNotificationStatus;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.RivalNotificationRepository;
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
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 라이벌 묶음 알림(D86)의 곡 목록·미리보기 쿼리와, BUNDLED 줄이 목록·개수·보관 삭제에 어떻게 닿는지 실제 MySQL에서 확인한다.
 * Docker가 필요하다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class RivalBundleMapperTest {

    static final LocalDate DAY = LocalDate.of(2026, 11, 15);
    static final Instant T = Instant.parse("2026-11-15T03:00:00Z");

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired NotificationMapper mapper;
    @Autowired RivalNotificationRepository repository;

    User me;
    User rival;
    User third;
    SongDifficulty[] charts = new SongDifficulty[5];
    RivalNotification bundle;
    RivalNotification m1;
    RivalNotification m2;
    RivalNotification m3;

    @BeforeEach
    void setUp() {
        me = persist(User.create("sub-me", "me@example.com", null));
        rival = persist(User.create("sub-rival", "rival@example.com", null));
        third = persist(User.create("sub-third", "third@example.com", null));
        for (int i = 0; i < charts.length; i++) {
            Song song = persist(Song.create("곡" + i, null, "test", null));
            charts[i] = persist(SongDifficulty.create(song, i % 2 == 0 ? InstrumentPart.GUITAR : InstrumentPart.BASS,
                    DifficultyType.MASTER, new BigDecimal("9.50")));
        }
        // 묶음 줄(첫 곡 = 곡0) + 합쳐진 3곡(곡1~3). 묶음이 센 곡 수는 4
        bundle = RivalNotification.pending(me, rival, charts[0], rate("90.00"), rate("80.00"), T, T);
        bundle.showAsBundle(rate("90.00"), rate("80.00"), DAY);
        persist(bundle);
        m1 = fold(charts[1], "91.00", "81.00");
        m2 = fold(charts[2], "92.00", "82.00");
        m3 = fold(charts[3], "93.00", "83.00");
        for (int i = 0; i < 3; i++) {
            bundle.addToBundle(T);
        }
        em.flush();
        em.clear();
    }

    private RivalNotification fold(SongDifficulty chart, String actor, String mine) {
        RivalNotification n = RivalNotification.pending(me, rival, chart, rate(actor), rate(mine), T, T);
        n.foldIntoBundle(rate(actor), rate(mine), DAY);
        return persist(n);
    }

    private static BigDecimal rate(String v) {
        return new BigDecimal(v);
    }

    private <E> E persist(E entity) {
        em.persist(entity);
        return entity;
    }

    @Test
    void 곡_목록은_묶음_줄_자신이_맨_앞이고_저장된_달성률을_쓴다() {
        List<RivalBundleSongRow> rows = mapper.findBundleSongs(me.getId(), rival.getId(), DAY, bundle.getId(), 20, 0);

        assertThat(rows).extracting(RivalBundleSongRow::title).containsExactly("곡0", "곡1", "곡2", "곡3");
        assertThat(rows.get(0).actorRate()).isEqualByComparingTo("90.00");
        assertThat(rows.get(2).myRate()).isEqualByComparingTo("82.00");
        assertThat(rows.get(1).part()).isEqualTo("BASS");
        assertThat(rows.get(0).difficulty()).isEqualTo("MASTER");
        assertThat(mapper.countBundleSongs(me.getId(), rival.getId(), DAY, bundle.getId())).isEqualTo(4);
    }

    @Test
    void 곡_목록은_쪽으로_나뉜다() {
        List<RivalBundleSongRow> second = mapper.findBundleSongs(me.getId(), rival.getId(), DAY, bundle.getId(), 2, 2);

        assertThat(second).extracting(RivalBundleSongRow::title).containsExactly("곡2", "곡3");
    }

    @Test
    void 삭제된_곡과_채보는_곡_목록에서_빠지지만_합친_줄_수에는_남는다() {
        em.find(Song.class, charts[1].getSong().getId()).delete();
        em.find(SongDifficulty.class, charts[2].getId()).delete();
        em.flush();
        em.clear();

        List<RivalBundleSongRow> rows = mapper.findBundleSongs(me.getId(), rival.getId(), DAY, bundle.getId(), 20, 0);

        assertThat(rows).extracting(RivalBundleSongRow::title).containsExactly("곡0", "곡3");
        assertThat(mapper.countBundleSongs(me.getId(), rival.getId(), DAY, bundle.getId())).isEqualTo(2);
        assertThat(mapper.findBundleMemberCounts(me.getId(), List.of(bundle.getId())))
                .extracting(RivalBundleCountRow::memberCount).containsExactly(3L);
    }

    @Test
    void 다른_날_다른_상대의_BUNDLED_줄은_섞이지_않는다() {
        RivalNotification otherDay = RivalNotification.pending(me, rival, charts[4], rate("95.00"), rate("85.00"), T, T);
        otherDay.foldIntoBundle(rate("95.00"), rate("85.00"), DAY.plusDays(1));
        persist(otherDay);
        RivalNotification otherActor = RivalNotification.pending(me, third, charts[4], rate("95.00"), rate("85.00"), T, T);
        otherActor.foldIntoBundle(rate("95.00"), rate("85.00"), DAY);
        persist(otherActor);
        em.flush();
        em.clear();

        assertThat(mapper.findBundleSongs(me.getId(), rival.getId(), DAY, bundle.getId(), 20, 0)).hasSize(4);
    }

    @Test
    void 다른_사람의_받는_사람_조건이면_곡이_나오지_않는다() {
        assertThat(mapper.findBundleSongs(third.getId(), rival.getId(), DAY, bundle.getId(), 20, 0)).isEmpty();
    }

    @Test
    void 미리보기는_묶음마다_합쳐진_처음_2곡이고_옛_묶음은_비어_있다() {
        RivalNotification old = RivalNotification.pending(me, third, charts[4], rate("95.00"), rate("85.00"), T, T);
        old.showAsBundle(rate("95.00"), rate("85.00"), DAY);   // 예전 묶음: 합쳐진 줄이 남아 있지 않다
        persist(old);
        for (int i = 0; i < 4; i++) {
            old.addToBundle(T);
        }
        em.flush();
        em.clear();

        List<RivalBundleSummaryRow> previews = mapper.findBundlePreviews(me.getId(), List.of(bundle.getId(), old.getId()));
        List<RivalBundleCountRow> counts = mapper.findBundleMemberCounts(me.getId(), List.of(bundle.getId(), old.getId()));

        assertThat(previews).extracting(RivalBundleSummaryRow::bundleId).containsOnly(bundle.getId());
        assertThat(previews).extracting(RivalBundleSummaryRow::title).containsExactly("곡1", "곡2");
        assertThat(counts).extracting(RivalBundleCountRow::bundleId, RivalBundleCountRow::memberCount)
                .containsExactlyInAnyOrder(org.assertj.core.groups.Tuple.tuple(bundle.getId(), 3L),
                        org.assertj.core.groups.Tuple.tuple(old.getId(), 0L));
    }

    @Test
    void BUNDLED_줄은_알림_목록과_개수에_나오지_않는다() {
        List<NotificationKey> page = mapper.findPage(me.getId(), 20, 0);

        assertThat(page).containsExactly(new NotificationKey("RIVAL", bundle.getId()));
        assertThat(mapper.countAll(me.getId())).isEqualTo(1);
        assertThat(repository.countByRecipient_IdAndStatusAndReadAtIsNull(me.getId(), RivalNotificationStatus.SHOWN)).isEqualTo(1);
        // 하루 3건 세기(따로 보인 줄)에도 들어가지 않는다
        assertThat(repository.countByRecipient_IdAndActor_IdAndAlertDateAndBundledFalseAndStatus(
                me.getId(), rival.getId(), DAY, RivalNotificationStatus.SHOWN)).isZero();
        assertThat(repository.markAllRead(me.getId(), T)).isEqualTo(1);
    }

    @Test
    void 보관_기간이_지나면_BUNDLED_줄도_지워진다() {
        int deleted = repository.deleteOlderThan(T.plusSeconds(1));
        em.clear();

        assertThat(deleted).isEqualTo(4);
        assertThat(repository.count()).isZero();
    }
}
