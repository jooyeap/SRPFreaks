package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserList;
import com.srpfreaks.backend.entity.UserListItem;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 내 리스트(D76) 스키마와 쿼리를 실제 MySQL(Flyway V20)에서 확인한다. Docker가 필요하다(CI에서만 돈다).
 * 내 것만 보임, 삭제된 곡의 채보는 곡 수·목록에서 제외, UNIQUE(리스트+채보, 사용자+이름은 대소문자 무시), 이름 CHECK,
 * 리스트 삭제·채보 삭제·탈퇴(users 행 삭제) 때 ON DELETE CASCADE로 항목이 완전히 지워지는지.
 * 테스트 사용자는 닉네임이 없는 계정이다(공개 여부와 무관한 개인 데이터라 닉네임이 필요 없다).
 */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class UserListRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired UserListRepository userListRepository;
    @Autowired UserListItemRepository userListItemRepository;

    User me;
    User other;
    SongDifficulty alive;
    SongDifficulty alsoAlive;
    SongDifficulty ofDeletedSong;

    @BeforeEach
    void setUp() {
        me = User.create("sub-ulist-me", "me-ulist@example.com", null);
        other = User.create("sub-ulist-other", "other-ulist@example.com", null);
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

    private UserList list(User owner, String name, int order) {
        UserList l = UserList.create(owner, name, order);
        em.persist(l);
        return l;
    }

    private UserListItem add(UserList l, SongDifficulty chart, int order) {
        UserListItem i = UserListItem.create(l, chart, order);
        em.persist(i);
        return i;
    }

    private long count(String table) {
        return ((Number) em.createNativeQuery("select count(*) from " + table).getSingleResult()).longValue();
    }

    @Test
    void 목록은_내_리스트만_순서대로_보이고_남의_리스트는_id를_알아도_찾을_수_없다() {
        UserList second = list(me, "두번째", 1);
        UserList first = list(me, "첫번째", 0);
        UserList others = list(other, "남의", 0);
        em.flush();
        em.clear();

        var page = userListRepository.findByUserId(me.getId(), PageRequest.of(0, 10, Sort.by("sortOrder", "id")));

        assertThat(page.getContent()).extracting(UserList::getName).containsExactly("첫번째", "두번째");
        assertThat(userListRepository.countByUserId(me.getId())).isEqualTo(2);
        assertThat(userListRepository.findByIdAndUserId(first.getId(), me.getId())).isPresent();
        assertThat(userListRepository.findByIdAndUserId(others.getId(), me.getId())).isEmpty();   // 남의 리스트는 404가 되는 근거
        assertThat(second.getId()).isNotNull();
    }

    @Test
    void 곡_수와_목록은_삭제된_곡의_채보를_뺀다() {
        UserList l = list(me, "연습", 0);
        add(l, alive, 0);
        add(l, alsoAlive, 1);
        add(l, ofDeletedSong, 2);
        em.flush();
        em.clear();

        var page = userListItemRepository.findVisibleByListId(l.getId(), PageRequest.of(0, 50));

        assertThat(page.getContent()).extracting(i -> i.getSongDifficulty().getId()).containsExactly(alive.getId(), alsoAlive.getId());
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(userListItemRepository.countVisibleByListId(l.getId())).isEqualTo(2);
        assertThat(userListItemRepository.findAllByListId(l.getId())).hasSize(3);   // 순서 바꾸기용은 숨은 줄도 본다
    }

    @Test
    void 여러_리스트의_곡_수를_한_번에_센다_곡이_없는_리스트는_결과에_없다() {
        UserList a = list(me, "A", 0);
        UserList b = list(me, "B", 1);
        UserList empty = list(me, "빈", 2);
        add(a, alive, 0);
        add(a, alsoAlive, 1);
        add(b, alive, 0);
        add(b, ofDeletedSong, 1);   // 삭제된 곡의 채보는 세지 않는다
        em.flush();
        em.clear();

        List<ListItemCount> counts = userListItemRepository.countVisibleByListIds(List.of(a.getId(), b.getId(), empty.getId()));

        assertThat(counts).extracting(ListItemCount::listId).containsExactlyInAnyOrder(a.getId(), b.getId());
        assertThat(counts.stream().filter(c -> c.listId().equals(a.getId())).findFirst().orElseThrow().count()).isEqualTo(2L);
        assertThat(counts.stream().filter(c -> c.listId().equals(b.getId())).findFirst().orElseThrow().count()).isEqualTo(1L);
    }

    @Test
    void 이_채보가_담긴_내_리스트만_알려_준다() {
        UserList a = list(me, "A", 0);
        UserList b = list(me, "B", 1);
        UserList others = list(other, "남의", 0);
        add(a, alive, 0);
        add(others, alive, 0);   // 남의 리스트에 담긴 것은 내 결과에 섞이지 않는다
        add(b, alsoAlive, 0);
        em.flush();
        em.clear();

        assertThat(userListItemRepository.findListIdsContaining(me.getId(), alive.getId())).containsExactly(a.getId());
        assertThat(userListItemRepository.findListIdsContaining(me.getId(), alsoAlive.getId())).containsExactly(b.getId());
        assertThat(userListItemRepository.findListIdsContaining(me.getId(), ofDeletedSong.getId())).isEmpty();
    }

    @Test
    void 같은_리스트에_같은_채보를_두_번_담으면_DB가_막는다() {
        UserList l = list(me, "연습", 0);
        add(l, alive, 0);
        em.flush();

        assertThat(userListItemRepository.findByUserListIdAndSongDifficultyId(l.getId(), alive.getId())).isPresent();
        assertThat(userListItemRepository.findByUserListIdAndSongDifficultyId(l.getId(), alsoAlive.getId())).isEmpty();
        assertThatThrownBy(() -> {
            add(l, alive, 1);
            em.flush();
        }).isInstanceOfAny(DataIntegrityViolationException.class, jakarta.persistence.PersistenceException.class);
    }

    @Test
    void 이름은_사용자_안에서_대소문자_구분_없이_중복_불가이고_다른_사용자는_같은_이름을_쓸_수_있다() {
        UserList first = list(me, "Practice", 0);
        em.flush();

        assertThat(userListRepository.countSameName(me.getId(), "practice", null)).isEqualTo(1);       // 대소문자 무시
        assertThat(userListRepository.countSameName(me.getId(), "practice", first.getId())).isZero();   // 자기 자신은 뺀다
        assertThat(userListRepository.countSameName(other.getId(), "practice", null)).isZero();
        assertThatThrownBy(() -> {
            list(me, "PRACTICE", 1);   // DB의 UNIQUE(user_id, name)도 utf8mb4_unicode_ci라 대소문자를 구분하지 않는다
            em.flush();
        }).isInstanceOfAny(DataIntegrityViolationException.class, jakarta.persistence.PersistenceException.class);
    }

    @Test
    void 이름_CHECK는_공백만이거나_20자를_넘는_이름을_막는다() {
        assertThatThrownBy(() -> {
            list(me, "   ", 0);
            em.flush();
        }).isInstanceOfAny(DataIntegrityViolationException.class, jakarta.persistence.PersistenceException.class);
    }

    @Test
    void 새_항목과_리스트는_가장_큰_순서값_뒤에_둘_수_있다() {
        assertThat(userListRepository.findMaxSortOrder(me.getId())).isNull();
        UserList l = list(me, "연습", 4);
        add(l, alive, 7);
        em.flush();

        assertThat(userListRepository.findMaxSortOrder(me.getId())).isEqualTo(4);
        assertThat(userListItemRepository.findMaxSortOrder(l.getId())).isEqualTo(7);
        assertThat(userListItemRepository.findMaxSortOrder(-1L)).isNull();
    }

    @Test
    void 리스트를_지우면_항목도_함께_지워진다() {
        UserList l = list(me, "연습", 0);
        UserList keep = list(me, "남길 것", 1);
        add(l, alive, 0);
        add(l, alsoAlive, 1);
        add(keep, alive, 0);
        em.flush();
        em.clear();

        userListRepository.deleteById(l.getId());
        em.flush();
        em.clear();

        assertThat(userListRepository.findByIdAndUserId(l.getId(), me.getId())).isEmpty();
        assertThat(count("user_list_items")).isEqualTo(1);   // 다른 리스트의 항목은 남는다
        assertThat(userListItemRepository.countVisibleByListId(keep.getId())).isEqualTo(1);
    }

    @Test
    void 탈퇴하면_두_테이블_모두_완전히_지워진다() {
        UserList l = list(me, "연습", 0);
        UserList others = list(other, "남의", 0);
        add(l, alive, 0);
        add(others, alive, 0);
        em.flush();
        em.clear();

        // 탈퇴(D20)는 users 행 하나를 지우는 것이다. 리스트와 항목은 DB의 ON DELETE CASCADE로 따라 지워진다.
        em.createNativeQuery("delete from users where user_id = :id").setParameter("id", me.getId()).executeUpdate();
        em.clear();

        assertThat(userListRepository.countByUserId(me.getId())).isZero();
        assertThat(userListRepository.countByUserId(other.getId())).isEqualTo(1);
        assertThat(count("user_lists")).isEqualTo(1);        // 남의 리스트만 남는다
        assertThat(count("user_list_items")).isEqualTo(1);   // 남의 항목만 남는다
    }

    @Test
    void 채보가_지워지면_항목도_따라_지워진다() {
        UserList l = list(me, "연습", 0);
        add(l, alive, 0);
        add(l, alsoAlive, 1);
        em.flush();
        em.clear();

        em.createNativeQuery("delete from song_difficulties where song_difficulty_id = :id")
                .setParameter("id", alsoAlive.getId()).executeUpdate();
        em.clear();

        assertThat(userListItemRepository.findAllByListId(l.getId())).extracting(i -> i.getSongDifficulty().getId())
                .containsExactly(alive.getId());
    }

    @Test
    void 기본_상한_설정이_마이그레이션으로_들어가_있다() {
        Object max = em.createNativeQuery("select setting_value from app_settings where setting_key = 'list.max_lists'").getSingleResult();
        Object items = em.createNativeQuery("select setting_value from app_settings where setting_key = 'list.max_items'").getSingleResult();
        assertThat(max).isEqualTo("10");
        assertThat(items).isEqualTo("50");
    }
}
