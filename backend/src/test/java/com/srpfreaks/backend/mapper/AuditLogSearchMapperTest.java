package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.AuditLog;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 감사 로그 검색 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다.
 * JPA로 로그를 넣고(flush) 같은 트랜잭션 안에서 MyBatis가 읽는다. pattern은 서비스가 이미 이스케이프한 LIKE 패턴('!' 이스케이프)이다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class AuditLogSearchMapperTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired AuditLogSearchMapper mapper;

    User root;
    User sakura;

    @BeforeEach
    void setUp() {
        root = persist(User.create("sub-audit-root", "audit-root@example.com", "RootAdmin"));
        sakura = persist(User.create("sub-audit-sakura", "audit-sakura@example.com", "さくら"));
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private AuditLog log(User actor, String action, String targetType, String targetId, Map<String, Object> detail) {
        return persist(AuditLog.record(actor, action, targetType, targetId, detail));
    }

    private static Map<String, Object> detail(String key, Object value) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put(key, value);
        return map;
    }

    private List<Long> ids(String action, String pattern) {
        em.flush();
        em.clear();
        return mapper.findIds(action, pattern, 100, 0);
    }

    @Test
    void 필터가_없으면_모든_로그가_최신순으로_나온다() {
        AuditLog first = log(root, "SONG_CREATE", "SONG", "1", detail("title", "A"));
        AuditLog second = log(root, "SONG_UPDATE", "SONG", "1", detail("title", "B"));

        assertThat(ids(null, null)).containsSubsequence(second.getId(), first.getId());
        assertThat(mapper.count(null, null)).isGreaterThanOrEqualTo(2);
    }

    @Test
    void 작업_종류는_같은_값만_걸러낸다() {
        AuditLog nick = log(sakura, "NICKNAME_CHANGE", "USER", String.valueOf(sakura.getId()), detail("after", "さくら"));
        log(root, "SONG_CREATE", "SONG", "1", detail("title", "A"));

        List<Long> found = ids("NICKNAME_CHANGE", null);

        assertThat(found).contains(nick.getId());
        assertThat(mapper.count("NICKNAME_CHANGE", null)).isEqualTo(found.size());
        assertThat(ids("NO_SUCH_ACTION", null)).isEmpty();
    }

    @Test
    void 로그_내용의_글자로_찾는다_닉네임_변경의_이전_새_닉네임도_찾는다() {
        Map<String, Object> change = new LinkedHashMap<>();
        change.put("before", "ふるい");
        change.put("after", "あたらしい");
        AuditLog nick = log(sakura, "NICKNAME_CHANGE", "USER", String.valueOf(sakura.getId()), change);
        log(root, "SONG_CREATE", "SONG", "1", detail("title", "Other"));

        assertThat(ids(null, "%ふるい%")).containsExactly(nick.getId());
        assertThat(ids(null, "%あたらしい%")).containsExactly(nick.getId());
        assertThat(ids(null, "%なにもない%")).isEmpty();
    }

    @Test
    void 작업한_사람의_닉네임으로_찾는다_대소문자는_구분하지_않는다() {
        AuditLog byRoot = log(root, "SONG_CREATE", "SONG", "1", detail("title", "A"));
        log(sakura, "NICKNAME_CHANGE", "USER", String.valueOf(sakura.getId()), detail("after", "x"));

        assertThat(ids(null, "%rootadmin%")).containsExactly(byRoot.getId());
    }

    @Test
    void 대상_사용자의_닉네임으로도_찾는다_역할_변경_로그는_대상_이름을_detail에_남기지_않는다() {
        Map<String, Object> role = new LinkedHashMap<>();
        role.put("before", "USER");
        role.put("after", "ADMIN");
        AuditLog roleChange = log(root, "USER_ROLE_CHANGE", "USER", String.valueOf(sakura.getId()), role);
        log(root, "SONG_CREATE", "SONG", "1", detail("title", "A"));

        // 작업한 사람은 RootAdmin이지만 대상 사용자 "さくら"로 찾을 수 있다. 다른 대상 종류(SONG)는 사용자로 해석하지 않는다
        assertThat(ids(null, "%さくら%")).containsExactly(roleChange.getId());
    }

    @Test
    void 대상_번호가_숫자가_아닌_로그가_있어도_검색이_깨지지_않는다() {
        AuditLog setting = log(root, "SETTING_UPDATE", "SETTING", "rating.list_single", detail("value", "15"));

        assertThat(ids(null, "%list_single%".replace("_", "!_"))).containsExactly(setting.getId());
    }

    @Test
    void 퍼센트와_밑줄은_이스케이프하면_글자_그대로만_찾는다() {
        AuditLog percent = log(root, "SONG_UPDATE", "SONG", "1", detail("note", "100% 달성"));
        AuditLog underscore = log(root, "SONG_UPDATE", "SONG", "2", detail("note", "a_b"));
        log(root, "SONG_UPDATE", "SONG", "3", detail("note", "100점 acb"));

        assertThat(ids(null, "%100!%%")).containsExactly(percent.getId());   // 검색어 "100%"
        assertThat(ids(null, "%a!_b%")).containsExactly(underscore.getId()); // 검색어 "a_b" (acb에는 걸리지 않는다)
    }

    @Test
    void 종류와_검색어를_함께_걸면_둘_다_맞는_로그만_나온다() {
        AuditLog both = log(sakura, "NICKNAME_CHANGE", "USER", String.valueOf(sakura.getId()), detail("after", "さくら2"));
        log(root, "SONG_UPDATE", "SONG", "1", detail("title", "さくら"));

        assertThat(ids("NICKNAME_CHANGE", "%さくら%")).containsExactly(both.getId());
    }

    @Test
    void 쪽을_나누면_최신순으로_이어지고_개수는_전체_일치_수다() {
        AuditLog a = log(root, "SONG_UPDATE", "SONG", "1", detail("note", "paging-key"));
        AuditLog b = log(root, "SONG_UPDATE", "SONG", "2", detail("note", "paging-key"));
        AuditLog c = log(root, "SONG_UPDATE", "SONG", "3", detail("note", "paging-key"));
        em.flush();
        em.clear();

        assertThat(mapper.count(null, "%paging-key%")).isEqualTo(3);
        assertThat(mapper.findIds(null, "%paging-key%", 2, 0)).containsExactly(c.getId(), b.getId());
        assertThat(mapper.findIds(null, "%paging-key%", 2, 2)).containsExactly(a.getId());
    }
}
