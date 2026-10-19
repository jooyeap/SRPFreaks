package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.SetlistRecommendRange;
import com.srpfreaks.backend.entity.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 사용자별 추천 범위를 실제 MySQL에서 확인한다(내 설정만, 초기화, DB CHECK·UNIQUE). Docker가 필요하다. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SetlistRecommendRangeRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired SetlistRecommendRangeRepository repository;

    User me;
    User other;

    @BeforeEach
    void setUp() {
        me = User.create("sub-range-me", "me-range@example.com", null);
        other = User.create("sub-range-other", "other-range@example.com", null);
        em.persist(me);
        em.persist(other);
    }

    private static SetlistRecommendRange range(User user, String ssMin, String ssMax, String sMin, String sMax) {
        return SetlistRecommendRange.create(user, new BigDecimal(ssMin), new BigDecimal(ssMax), new BigDecimal(sMin), new BigDecimal(sMax));
    }

    @Test
    void 내_설정만_읽는다() {
        em.persist(range(me, "-0.60", "-0.10", "-0.10", "0.40"));
        em.persist(range(other, "-1.00", "-0.50", "0.00", "1.00"));
        em.flush();
        em.clear();

        SetlistRecommendRange mine = repository.findByUserId(me.getId()).orElseThrow();

        assertThat(mine.getSsMin()).isEqualByComparingTo("-0.60");
        assertThat(mine.getSMax()).isEqualByComparingTo("0.40");
        assertThat(repository.findByUserId(other.getId()).orElseThrow().getSsMin()).isEqualByComparingTo("-1.00");
    }

    @Test
    void 설정이_없으면_빈_값이다() {
        assertThat(repository.findByUserId(me.getId())).isEmpty();
    }

    @Test
    void 초기화하면_내_설정만_지워진다() {
        em.persist(range(me, "-0.60", "-0.10", "-0.10", "0.40"));
        em.persist(range(other, "-1.00", "-0.50", "0.00", "1.00"));
        em.flush();

        repository.deleteByUserId(me.getId());
        em.flush();
        em.clear();

        assertThat(repository.findByUserId(me.getId())).isEmpty();
        assertThat(repository.findByUserId(other.getId())).isPresent();
        repository.deleteByUserId(me.getId());   // 없어도 오류가 아니다
    }

    @Test
    void 사용자당_한_줄만_둘_수_있다() {
        em.persist(range(me, "-0.60", "-0.10", "-0.10", "0.40"));
        em.flush();

        assertThatThrownBy(() -> {
            em.persist(range(me, "-1.00", "-0.50", "0.00", "1.00"));
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 하한이_상한보다_크거나_범위를_벗어난_값은_DB가_막는다() {
        assertThatThrownBy(() -> {
            em.persist(range(me, "-0.10", "-0.60", "-0.10", "0.40"));
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 범위를_벗어난_값은_DB가_막는다() {
        assertThatThrownBy(() -> {
            em.persist(range(other, "-0.60", "-0.10", "-0.10", "3.50"));
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }
}
