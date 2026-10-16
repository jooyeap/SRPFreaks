package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.Platform;
import com.srpfreaks.backend.entity.SetlistItem;
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
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 세트리스트 쿼리를 실제 MySQL에서 확인한다(내 줄만, 삭제된 채보 제외, 최근 수정 시각, 중복 방지). Docker가 필요하다. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SetlistRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired SetlistItemRepository setlistItemRepository;
    @Autowired OptionRecordRepository optionRecordRepository;

    User me;
    User other;
    SongDifficulty alive;
    SongDifficulty alsoAlive;
    SongDifficulty ofDeletedSong;

    @BeforeEach
    void setUp() {
        me = User.create("sub-setlist-me", "me-setlist@example.com", null);
        other = User.create("sub-setlist-other", "other-setlist@example.com", null);
        em.persist(me);
        em.persist(other);

        Song song = Song.create("살아있는 곡", "A", "test", me);
        em.persist(song);
        alive = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        alsoAlive = SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("9.00"));
        em.persist(alive);
        em.persist(alsoAlive);

        Song deleted = Song.create("지운 곡", "A", "test", me);
        em.persist(deleted);
        ofDeletedSong = SongDifficulty.create(deleted, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        em.persist(ofDeletedSong);
        deleted.delete();
        em.flush();
    }

    @Test
    void 내_줄만_담은_순서대로_보이고_삭제된_곡의_채보는_뺀다() {
        em.persist(SetlistItem.create(me, alive));
        em.persist(SetlistItem.create(me, alsoAlive));
        em.persist(SetlistItem.create(me, ofDeletedSong));
        em.persist(SetlistItem.create(other, alive));
        em.flush();
        em.clear();

        var page = setlistItemRepository.findActiveByUserId(me.getId(), PageRequest.of(0, 30));

        assertThat(page.getContent()).extracting(i -> i.getSongDifficulty().getId())
                .containsExactly(alive.getId(), alsoAlive.getId());
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(setlistItemRepository.countActiveByUserId(me.getId())).isEqualTo(2);
        assertThat(setlistItemRepository.countActiveByUserId(other.getId())).isEqualTo(1);
        assertThat(setlistItemRepository.findAllByUserId(me.getId())).hasSize(3); // 비우기용은 삭제된 채보의 줄도 본다
    }

    @Test
    void 남의_줄은_id를_알아도_찾을_수_없다() {
        SetlistItem mine = SetlistItem.create(me, alive);
        em.persist(mine);
        em.flush();

        assertThat(setlistItemRepository.findByIdAndUserId(mine.getId(), me.getId())).isPresent();
        assertThat(setlistItemRepository.findByIdAndUserId(mine.getId(), other.getId())).isEmpty();
    }

    @Test
    void 같은_채보를_두_번_담으면_DB가_막는다() {
        em.persist(SetlistItem.create(me, alive));
        em.flush();

        assertThat(setlistItemRepository.existsByUserIdAndSongDifficultyId(me.getId(), alive.getId())).isTrue();
        assertThat(setlistItemRepository.existsByUserIdAndSongDifficultyId(other.getId(), alive.getId())).isFalse();
        assertThatThrownBy(() -> {
            em.persist(SetlistItem.create(me, alive));
            em.flush();
        }).isInstanceOfAny(DataIntegrityViolationException.class, jakarta.persistence.PersistenceException.class);
    }

    @Test
    void 채보별_가장_최근_수정_시각은_내_기록만_본다() {
        em.persist(OptionRecord.create(me, alive, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal("90.00"), false,
                Instant.parse("2026-10-01T00:00:00Z"), Platform.ARCADE, null));
        em.persist(OptionRecord.create(other, alsoAlive, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal("99.00"), false,
                Instant.parse("2026-10-01T00:00:00Z"), Platform.ARCADE, null));
        em.flush();

        List<RecordLatestUpdate> latest = optionRecordRepository.findLatestUpdates(me.getId(),
                NoteOption.SUPER_RANDOM_PLUS, List.of(alive.getId(), alsoAlive.getId()));

        assertThat(latest).extracting(RecordLatestUpdate::songDifficultyId).containsExactly(alive.getId()); // 남의 기록과 기록 없는 채보는 없다
        assertThat(latest.get(0).latestUpdate()).isNotNull();
    }
}
