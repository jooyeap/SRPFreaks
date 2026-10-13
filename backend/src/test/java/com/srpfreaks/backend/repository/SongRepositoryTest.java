package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.entity.TitleKind;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.service.SongQueryService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

/** 곡 검색 쿼리를 실제 MySQL에서 확인한다(곡명/아티스트/별칭 검색, 삭제 제외, LIKE 이스케이프). Docker가 필요하다. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SongRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired SongRepository songRepository;

    private final PageRequest page = PageRequest.of(0, 20, Sort.by("id"));

    @BeforeEach
    void setUp() {
        User user = User.create("sub-song-test", "song@example.com", null);
        em.persist(user);

        Song necro = Song.create("ネクロファンタジア", "ARM", "test", user);
        em.persist(necro);
        em.persist(SongTitle.create(necro, TitleKind.ROMAJI, "Necro Fantasia"));

        Song percent = Song.create("100% Real", "Someone", "test", user);
        em.persist(percent);

        Song deleted = Song.create("Necro Deleted", "ARM", "test", user);
        deleted.delete();
        em.persist(deleted);
        em.flush();
        em.clear();
    }

    private long count(String keyword) {
        return songRepository.search(SongQueryService.likePattern(keyword),
                SongQueryService.likePattern(SongTitle.normalize(keyword)), page).getTotalElements();
    }

    @Test
    void 곡명으로_찾는다() {
        assertThat(count("ネクロ")).isEqualTo(1);
    }

    @Test
    void 별칭_표기는_공백과_대소문자를_무시하고_찾는다() {
        assertThat(count("necro  FANTASIA")).isEqualTo(1);
    }

    @Test
    void 아티스트로_찾고_삭제된_곡은_제외한다() {
        // ARM 곡은 2개지만 하나는 삭제 상태
        assertThat(count("ARM")).isEqualTo(1);
    }

    @Test
    void 퍼센트와_밑줄은_와일드카드가_아니라_문자로_찾는다() {
        assertThat(count("100%")).isEqualTo(1);
        assertThat(count("%")).isEqualTo(1);       // '%' 문자가 들어 있는 곡만
        assertThat(count("_")).isZero();           // '_' 문자가 들어 있는 곡 없음 (와일드카드면 전부 걸린다)
    }

    @Test
    void 키워드가_없는_목록은_삭제된_곡을_제외한다() {
        assertThat(songRepository.findByDeletedFalse(page).getTotalElements()).isEqualTo(2);
    }
}
