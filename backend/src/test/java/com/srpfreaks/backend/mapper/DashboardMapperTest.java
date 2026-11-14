package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.Suggestion;
import com.srpfreaks.backend.entity.SuggestionCategory;
import com.srpfreaks.backend.entity.SuggestionStatus;
import com.srpfreaks.backend.entity.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionTemplate;
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
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 관리자 대시보드(D80) 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다(CI에서만 돈다).
 * 확인하는 것: (1) 한국 시간 하루 경계(UTC 14:59:59 = KST 23:59:59, UTC 15:00:00 = 다음날 KST 0시, 기간의 시작·끝 포함/제외),
 * (2) 개수 집계, (3) 공개 프로필·티어 분포 대상에 비공개·차단 유저가 들어가지 않는 것.
 * 시각은 저장 뒤에 created_at을 직접 정해 둔다(엔티티는 저장 시각을 스스로 채우므로, 실행하는 날짜에 결과가 흔들리지 않게 모두 정한다).
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class DashboardMapperTest {

    static final String SRN_PLUS = NoteOption.SUPER_RANDOM_PLUS.name();
    static final int KST = 9 * 3600;
    /** 한국 시간 2026-11-09 00:00 ~ 2026-11-16 00:00(포함 안 함) = 7일 창(오늘이 11/15인 날). */
    static final LocalDateTime SINCE = LocalDateTime.parse("2026-11-08T15:00:00");
    static final LocalDateTime UNTIL = LocalDateTime.parse("2026-11-15T15:00:00");
    /** 모든 테스트 유저·기록의 기본 시각: 창 밖(아주 오래전)이라 창 안 개수에 섞이지 않는다. */
    static final LocalDateTime LONG_AGO = LocalDateTime.parse("2020-01-01T00:00:00");

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired DashboardMapper mapper;
    @Autowired SqlSessionTemplate sqlSession;

    SongDifficulty chart;
    int seq = 0;

    @BeforeEach
    void setUp() {
        Song song = persist(Song.create("곡", null, "test", null));
        chart = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    /** 유저를 만들고 created_at을 직접 정한다. */
    private User user(boolean publicProfile, LocalDateTime createdAt) {
        int n = ++seq;
        User u = User.create("sub-d" + n, "d" + n + "@example.com", "dash" + n);
        if (publicProfile) {
            u.changeProfilePublic(true);
        }
        persist(u);
        em.flush();
        em.createNativeQuery("UPDATE users SET created_at = ?1 WHERE user_id = ?2").setParameter(1, createdAt).setParameter(2, u.getId()).executeUpdate();
        return u;
    }

    private User publicUser() {
        return user(true, LONG_AGO);
    }

    private User privateUser() {
        return user(false, LONG_AGO);
    }

    private User blockedPublicUser() {
        User u = publicUser();
        u.block();
        return u;
    }

    private OptionRecord record(User user, NoteOption option, LocalDateTime createdAt) {
        OptionRecord r = persist(OptionRecord.create(user, chart, option, new BigDecimal("90.00"), false, (Instant) null, null, null));
        em.flush();
        em.createNativeQuery("UPDATE option_records SET created_at = ?1 WHERE option_record_id = ?2")
                .setParameter(1, createdAt).setParameter(2, r.getId()).executeUpdate();
        return r;
    }

    private void fresh() {
        em.flush();
        em.clear();
        // MyBatis는 한 트랜잭션 안에서 같은 SQL·파라미터의 결과를 캐시하므로 데이터를 바꿔 가며 같은 쿼리를 다시 부르는 테스트는 캐시를 비운다
        sqlSession.clearCache();
    }

    private static LocalDateTime at(String utc) {
        return LocalDateTime.parse(utc);
    }

    // ---- 가입자·공개 프로필 개수

    @Test
    void 전체_가입자는_공개_비공개_차단을_모두_센다() {
        long before = mapper.countUsers();
        publicUser();
        privateUser();
        blockedPublicUser();
        fresh();

        assertThat(mapper.countUsers() - before).isEqualTo(3);
    }

    @Test
    void 공개_프로필_수는_공개이고_ACTIVE인_유저만_센다() {
        long before = mapper.countPublicProfiles();
        publicUser();
        publicUser();
        privateUser();            // 비공개
        blockedPublicUser();      // 공개였지만 차단
        fresh();

        assertThat(mapper.countPublicProfiles() - before).isEqualTo(2);
    }

    // ---- 한국 시간 하루 묶기

    @Test
    void 가입자는_한국_시간_하루로_묶이고_기간_경계가_맞다() {
        user(false, at("2026-11-08T14:59:59"));   // 창 시작 1초 전(KST 11/8 23:59:59) -> 제외
        user(false, at("2026-11-08T15:00:00"));   // KST 11/9 00:00:00 -> 포함(첫날)
        user(false, at("2026-11-13T14:59:59"));   // KST 11/13 23:59:59
        user(false, at("2026-11-13T15:00:00"));   // KST 11/14 00:00:00 (UTC 날짜는 여전히 13일)
        user(false, at("2026-11-14T03:00:00"));   // KST 11/14 12:00
        user(false, at("2026-11-15T14:59:59"));   // KST 11/15 23:59:59 -> 포함(마지막 날)
        user(false, at("2026-11-15T15:00:00"));   // KST 11/16 00:00:00 -> 끝(포함 안 함) -> 제외
        fresh();

        List<DayCountRow> rows = mapper.countSignupsByDay(SINCE, UNTIL, KST);

        assertThat(rows).extracting(DayCountRow::day, DayCountRow::count).containsExactly(
                org.assertj.core.groups.Tuple.tuple(LocalDate.parse("2026-11-09"), 1L),
                org.assertj.core.groups.Tuple.tuple(LocalDate.parse("2026-11-13"), 1L),
                org.assertj.core.groups.Tuple.tuple(LocalDate.parse("2026-11-14"), 2L),
                org.assertj.core.groups.Tuple.tuple(LocalDate.parse("2026-11-15"), 1L));
    }

    @Test
    void 기록_입력_수는_한국_시간_하루로_묶이고_모든_옵션을_센다() {
        User u = publicUser();
        record(u, NoteOption.SUPER_RANDOM_PLUS, at("2026-11-08T14:59:59"));   // 창 밖
        record(u, NoteOption.SUPER_RANDOM_PLUS, at("2026-11-13T14:59:59"));   // KST 11/13
        record(u, NoteOption.SUPER_RANDOM_PLUS, at("2026-11-13T15:00:00"));   // KST 11/14
        record(u, NoteOption.NORMAL, at("2026-11-14T10:00:00"));              // KST 11/14 (다른 옵션도 센다)
        record(privateUser(), NoteOption.SUPER_RANDOM_PLUS, at("2026-11-14T20:00:00"));   // KST 11/15, 비공개 유저의 기록도 "건수"로는 센다(개인은 드러나지 않는다)
        record(u, NoteOption.SUPER_RANDOM_PLUS, at("2026-11-15T15:00:00"));   // 끝(포함 안 함)
        fresh();

        List<DayCountRow> rows = mapper.countRecordsByDay(SINCE, UNTIL, KST);

        assertThat(rows).extracting(DayCountRow::day, DayCountRow::count).containsExactly(
                org.assertj.core.groups.Tuple.tuple(LocalDate.parse("2026-11-13"), 1L),
                org.assertj.core.groups.Tuple.tuple(LocalDate.parse("2026-11-14"), 2L),
                org.assertj.core.groups.Tuple.tuple(LocalDate.parse("2026-11-15"), 1L));
    }

    // ---- 건의 상태

    @Test
    void 건의는_상태별로_센다() {
        User u = publicUser();
        persist(Suggestion.create(u, SuggestionCategory.OTHER, "접수1", "내용"));
        persist(Suggestion.create(u, SuggestionCategory.OTHER, "접수2", "내용"));
        Suggestion done = persist(Suggestion.create(u, SuggestionCategory.BUG, "완료", "내용"));
        done.review(SuggestionStatus.DONE, null);
        Suggestion rejected = persist(Suggestion.create(u, SuggestionCategory.BUG, "반려", "내용"));
        rejected.review(SuggestionStatus.REJECTED, "사유");
        fresh();

        List<StatusCountRow> rows = mapper.countSuggestionsByStatus();

        assertThat(rows).extracting(StatusCountRow::status, StatusCountRow::count).contains(
                org.assertj.core.groups.Tuple.tuple("RECEIVED", 2L),
                org.assertj.core.groups.Tuple.tuple("DONE", 1L),
                org.assertj.core.groups.Tuple.tuple("REJECTED", 1L));
        assertThat(rows).extracting(StatusCountRow::status).doesNotContain("REVIEWING");   // 없는 상태는 나오지 않는다(서비스가 0으로 채운다)
    }

    // ---- 티어 분포 대상: 비공개·차단 유저는 읽지 않는다

    @Test
    void 티어_분포_대상은_SRN_기록이_있는_공개_ACTIVE_유저만이고_비공개_차단_id는_읽지_않는다() {
        User open = publicUser();
        record(open, NoteOption.SUPER_RANDOM_PLUS, LONG_AGO);
        record(open, NoteOption.SUPER_RANDOM_PLUS, LONG_AGO);                 // 같은 유저가 여러 번 -> id는 한 번만
        User openOtherOption = publicUser();
        record(openOtherOption, NoteOption.NORMAL, LONG_AGO);                 // SRN+ 기록이 없다
        publicUser();                                                         // 기록 없음
        User hidden = privateUser();
        record(hidden, NoteOption.SUPER_RANDOM_PLUS, LONG_AGO);               // 비공개
        User blocked = blockedPublicUser();
        record(blocked, NoteOption.SUPER_RANDOM_PLUS, LONG_AGO);              // 차단
        fresh();

        List<Long> ids = mapper.findTierUserIds(SRN_PLUS);

        assertThat(ids).containsExactly(open.getId());
        assertThat(ids).doesNotContain(hidden.getId(), blocked.getId());
    }

    @Test
    void SRN_기록이_있는_전체_유저_수는_비공개도_개수로_센다() {
        long before = mapper.countRecordedUsers(SRN_PLUS);
        record(publicUser(), NoteOption.SUPER_RANDOM_PLUS, LONG_AGO);
        User many = privateUser();
        record(many, NoteOption.SUPER_RANDOM_PLUS, LONG_AGO);
        record(many, NoteOption.SUPER_RANDOM_PLUS, LONG_AGO);                 // 한 유저는 한 번
        record(publicUser(), NoteOption.NORMAL, LONG_AGO);                    // 다른 옵션만
        fresh();

        assertThat(mapper.countRecordedUsers(SRN_PLUS) - before).isEqualTo(2);
    }
}
