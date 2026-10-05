package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 사용자 조회/저장. */
public interface UserRepository extends JpaRepository<User, Long> {

    /** 구글 로그인: 구글 계정 고유 ID(sub)로 사용자를 찾는다. */
    Optional<User> findByGoogleSub(String googleSub);

    Optional<User> findByEmail(String email);
}
