package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

/** 관리 화면 사용자 검색 쿼리를 실제 MySQL에서 확인한다(닉네임·이메일 부분 일치, 대소문자 무시, 와일드카드 문자 취급). Docker가 필요하다. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class UserRepositorySearchTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired UserRepository userRepository;

    @BeforeEach
    void setUp() {
        em.persist(User.create("sub-a", "alice@example.com", "Alice", Role.USER));
        em.persist(User.create("sub-b", "bob@example.com", "드러머밥", Role.USER));
        em.persist(User.create("sub-c", "carol@example.com", "100%_fan", Role.USER));
        em.flush();
    }

    private java.util.List<String> search(String q) {
        return userRepository
                .findByNicknameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrderByIdAsc(q, q, PageRequest.of(0, 10))
                .map(User::getNickname).getContent();
    }

    @Test
    void 닉네임_일부로_찾고_대소문자는_무시한다() {
        assertThat(search("ALI")).containsExactly("Alice");
        assertThat(search("드러머")).containsExactly("드러머밥");
    }

    @Test
    void 이메일_일부로도_찾는다() {
        assertThat(search("bob@")).containsExactly("드러머밥");
    }

    @Test
    void 퍼센트와_밑줄은_와일드카드가_아니라_글자로_찾는다() {
        assertThat(search("%")).containsExactly("100%_fan");
        assertThat(search("_")).containsExactly("100%_fan");
        assertThat(search("zzz")).isEmpty();
    }
}
