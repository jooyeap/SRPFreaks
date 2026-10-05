package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.RefreshToken;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Refresh Token 조회/저장. */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /** 토큰 원문이 아니라 SHA-256 해시로 찾는다. */
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** 재사용 탐지 시 같은 로그인(family)의 토큰을 모두 폐기하기 위해 찾는다. */
    List<RefreshToken> findAllByFamilyId(String familyId);
}
