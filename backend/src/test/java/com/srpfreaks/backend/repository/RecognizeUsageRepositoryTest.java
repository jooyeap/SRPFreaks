package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.RecognizeUsage;
import com.srpfreaks.backend.entity.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 사진 입력(D55) 사용량 질의를 실제 MySQL에서 확인한다(V18 스키마·인덱스·기본 설정 포함). Docker가 필요하다.
 */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class RecognizeUsageRepositoryTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired RecognizeUsageRepository repository;
    @Autowired AppSettingRepository settingRepository;

    private static final Instant NOW = Instant.parse("2026-10-28T05:00:00Z");

    @Test
    void 사용자별_최근_7일_개수와_가장_오래된_사용_전체_개수를_센다() {
        User a = user("a");
        User b = user("b");
        repository.save(RecognizeUsage.of(a, NOW.minusSeconds(8 * 86400)));   // 7일 밖
        repository.save(RecognizeUsage.of(a, NOW.minusSeconds(6 * 86400)));   // 7일 안, 가장 오래됨
        repository.save(RecognizeUsage.of(a, NOW.minusSeconds(3600)));
        repository.save(RecognizeUsage.of(b, NOW.minusSeconds(60)));
        em.flush();
        em.clear();

        Instant since = NOW.minusSeconds(7 * 86400);
        assertThat(repository.countByUser_IdAndUsedAtAfter(a.getId(), since)).isEqualTo(2);
        assertThat(repository.countByUser_IdAndUsedAtAfter(b.getId(), since)).isEqualTo(1);
        assertThat(repository.findFirstByUser_IdAndUsedAtAfterOrderByUsedAtAsc(a.getId(), since))
                .get().extracting(RecognizeUsage::getUsedAt).isEqualTo(NOW.minusSeconds(6 * 86400));
        assertThat(repository.countByUsedAtGreaterThanEqual(NOW.minusSeconds(7200))).isEqualTo(2);
    }

    @Test
    void 기간이_지난_줄만_지운다() {
        User a = user("c");
        repository.save(RecognizeUsage.of(a, NOW.minusSeconds(9 * 86400)));
        repository.save(RecognizeUsage.of(a, NOW.minusSeconds(86400)));
        em.flush();

        int deleted = repository.deleteOlderThan(NOW.minusSeconds(8 * 86400));
        assertThat(deleted).isEqualTo(1);
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void 기본_설정은_꺼짐_ADMIN_30장_300장이다() {
        assertThat(settingRepository.findById("recognize.enabled")).get().extracting(AppSetting::getValue).isEqualTo("false");
        assertThat(settingRepository.findById("recognize.min_role")).get().extracting(AppSetting::getValue).isEqualTo("ADMIN");
        assertThat(settingRepository.findById("recognize.weekly_limit")).get().extracting(AppSetting::getValue).isEqualTo("30");
        assertThat(settingRepository.findById("recognize.daily_total_limit")).get().extracting(AppSetting::getValue).isEqualTo("300");
    }

    private User user(String name) {
        User user = User.create("sub-recognize-" + name, name + "@example.com", null);
        em.persist(user);
        return user;
    }
}
