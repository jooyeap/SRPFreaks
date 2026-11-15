package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.ChartPlayCount;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.PlayCountCursor;
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
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/** 플레이 횟수 upsert(D84)를 실제 MySQL에서 확인한다(V22 스키마, 탈퇴·채보 삭제 시 함께 삭제). Docker가 필요하다. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class ChartPlayCountRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    static final Instant T1 = Instant.parse("2026-11-14T10:00:00Z");
    static final Instant T2 = Instant.parse("2026-11-14T10:10:00.123Z");

    @Autowired EntityManager em;
    @Autowired ChartPlayCountRepository countRepository;
    @Autowired PlayCountCursorRepository cursorRepository;

    User me;
    User other;
    SongDifficulty guitar;
    SongDifficulty bass;

    @BeforeEach
    void setUp() {
        me = User.create("sub-pc-me", "me-pc@example.com", null);
        other = User.create("sub-pc-other", "other-pc@example.com", null);
        em.persist(me);
        em.persist(other);
        Song song = Song.create("곡", "A", "test", me);
        em.persist(song);
        guitar = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        bass = SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("9.00"));
        em.persist(guitar);
        em.persist(bass);
        em.flush();
    }

    private ChartPlayCount reload(User user, SongDifficulty chart) {
        em.flush();
        em.clear();
        return countRepository.findByUser_IdAndSongDifficulty_Id(user.getId(), chart.getId()).orElseThrow();
    }

    private long rows() {
        em.flush();
        em.clear();
        return em.createQuery("select count(c) from ChartPlayCount c", Long.class).getSingleResult();
    }

    @Test
    void 처음에는_줄을_만들고_다시_부르면_횟수를_더한다() {
        countRepository.addPlays(me.getId(), guitar.getId(), 1, T1);
        countRepository.addPlays(me.getId(), guitar.getId(), 3, T2);

        ChartPlayCount count = reload(me, guitar);
        assertThat(count.getPlayCount()).isEqualTo(4);
        assertThat(count.getLastPlayedAt()).isEqualTo(T2);
        assertThat(count.getCreatedAt()).isNotNull();
        assertThat(rows()).isEqualTo(1); // 같은 (사용자, 채보)는 한 줄
    }

    @Test
    void 마지막_플레이_시각은_더_늦은_값만_남긴다() {
        countRepository.addPlays(me.getId(), guitar.getId(), 1, T2);
        countRepository.addPlays(me.getId(), guitar.getId(), 1, T1); // 이른 플레이를 나중에 넣어도 뒤로 가지 않는다

        ChartPlayCount count = reload(me, guitar);
        assertThat(count.getPlayCount()).isEqualTo(2);
        assertThat(count.getLastPlayedAt()).isEqualTo(T2);
    }

    @Test
    void 사용자와_채보별로_따로_센다() {
        countRepository.addPlays(me.getId(), guitar.getId(), 2, T1);
        countRepository.addPlays(me.getId(), bass.getId(), 1, T1);
        countRepository.addPlays(other.getId(), guitar.getId(), 5, T1);

        assertThat(reload(me, guitar).getPlayCount()).isEqualTo(2);
        assertThat(reload(me, bass).getPlayCount()).isEqualTo(1);
        assertThat(reload(other, guitar).getPlayCount()).isEqualTo(5);
        assertThat(rows()).isEqualTo(3);
    }

    @Test
    void 커서는_한_줄만_만들고_앞으로만_옮긴다() {
        cursorRepository.ensureExists(me.getId());
        cursorRepository.ensureExists(me.getId()); // 두 번 불러도 한 줄
        em.flush();
        em.clear();

        PlayCountCursor cursor = cursorRepository.findForUpdate(me.getId()).orElseThrow();
        assertThat(cursor.getLastCountedAt()).isNull();
        cursor.advanceTo(T2);
        cursor.advanceTo(T1);
        em.flush();
        em.clear();

        assertThat(cursorRepository.findForUpdate(me.getId()).orElseThrow().getLastCountedAt()).isEqualTo(T2);
        assertThat(cursorRepository.findForUpdate(other.getId())).isEmpty();
    }

    @Test
    void 탈퇴하면_횟수와_커서가_함께_지워진다() {
        // 곡을 등록한 사용자(me)가 아니라 other가 탈퇴한다(곡의 등록자 FK와 무관하게 CASCADE만 보려고)
        countRepository.addPlays(me.getId(), guitar.getId(), 2, T1);
        countRepository.addPlays(other.getId(), guitar.getId(), 1, T1);
        cursorRepository.ensureExists(me.getId());
        cursorRepository.ensureExists(other.getId());
        em.flush();

        em.createNativeQuery("delete from users where user_id = :id").setParameter("id", other.getId()).executeUpdate();
        em.clear();

        assertThat(countRepository.findByUser_IdAndSongDifficulty_Id(other.getId(), guitar.getId())).isEmpty();
        assertThat(cursorRepository.findForUpdate(other.getId())).isEmpty();
        assertThat(countRepository.findByUser_IdAndSongDifficulty_Id(me.getId(), guitar.getId())).isPresent(); // 남의 것은 그대로
        assertThat(cursorRepository.findForUpdate(me.getId())).isPresent();
    }

    @Test
    void 채보를_하드_삭제해도_그_채보의_횟수만_따라_지워진다() {
        countRepository.addPlays(me.getId(), guitar.getId(), 2, T1);
        countRepository.addPlays(me.getId(), bass.getId(), 1, T1);
        em.flush();

        em.createNativeQuery("delete from song_difficulties where song_difficulty_id = :id").setParameter("id", guitar.getId()).executeUpdate();
        em.clear();

        assertThat(countRepository.findByUser_IdAndSongDifficulty_Id(me.getId(), guitar.getId())).isEmpty();
        assertThat(countRepository.findByUser_IdAndSongDifficulty_Id(me.getId(), bass.getId())).isPresent();
    }
}
