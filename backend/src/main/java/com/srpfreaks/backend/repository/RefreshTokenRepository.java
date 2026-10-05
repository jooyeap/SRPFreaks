package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

/** Refresh Token 조회/저장. */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /** 토큰 원문이 아니라 SHA-256 해시로 찾는다. */
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /**
     * 재발급(Rotation)용 조회. 행을 잠가서(SELECT ... FOR UPDATE) 같은 토큰으로 동시에 두 번 재발급하는 것을 막는다.
     * 잠그지 않으면 두 요청이 모두 "아직 안 쓴 토큰"으로 보고 유효한 새 토큰을 둘 다 발급해 버린다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t where t.tokenHash = :tokenHash")
    Optional<RefreshToken> findForUpdateByTokenHash(@Param("tokenHash") String tokenHash);

    /** 재사용 탐지 시 같은 로그인(family)의 토큰을 모두 폐기하기 위해 찾는다. */
    List<RefreshToken> findAllByFamilyId(String familyId);

    /** 같은 로그인(family)의 살아 있는 토큰을 한 번에 폐기한다. 이미 폐기된 것의 폐기 시각은 바꾸지 않는다. */
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now where t.familyId = :familyId and t.revokedAt is null")
    int revokeFamily(@Param("familyId") String familyId, @Param("now") Instant now);
}
