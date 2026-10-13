package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.ImportToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

/** 가져오기 토큰 조회/저장. */
public interface ImportTokenRepository extends JpaRepository<ImportToken, Long> {

    /** 토큰 원문이 아니라 SHA-256 해시로 찾는다. 폐기된 줄도 나오므로 호출하는 쪽이 isRevoked를 확인한다. */
    Optional<ImportToken> findByTokenHash(String tokenHash);

    /** 사용자의 아직 폐기되지 않은 토큰(최신 하나). 사용자당 하나만 쓰는 것이 규칙이라 보통 0~1개다. */
    Optional<ImportToken> findFirstByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(Long userId);

    /** 사용자의 살아 있는 토큰을 모두 폐기한다(새로 발급하기 전, 또는 사용자가 폐기할 때). 폐기된 줄의 시각은 바꾸지 않는다. */
    @Modifying
    @Query("update ImportToken t set t.revokedAt = :now where t.user.id = :userId and t.revokedAt is null")
    int revokeAllActiveOf(@Param("userId") Long userId, @Param("now") Instant now);
}
