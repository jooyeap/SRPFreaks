package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Rival;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RivalRepository extends JpaRepository<Rival, Long> {

    long countByUser_Id(Long userId);

    boolean existsByUser_IdAndTarget_Id(Long userId, Long targetId);

    Optional<Rival> findByUser_IdAndTarget_Id(Long userId, Long targetId);

    /** 내 라이벌 목록 + 상대(fetch join, 상대마다 따로 읽으면 N+1). 등록한 순서. */
    @Query("""
            select r from Rival r join fetch r.target
            where r.user.id = :userId
            order by r.createdAt asc, r.id asc
            """)
    List<Rival> findWithTargetByUserId(@Param("userId") Long userId);

    /**
     * 서로 라이벌인 상대: 내가 등록했고(r), 상대도 나를 등록한(r2) 사람. 역전 알림을 누구에게 보낼지 정할 때 쓴다.
     * exists 서브쿼리라서 상대가 몇 명이든 쿼리 한 번이다.
     */
    @Query("""
            select r.target from Rival r
            where r.user.id = :userId
              and exists (select 1 from Rival r2 where r2.user.id = r.target.id and r2.target.id = :userId)
            """)
    List<User> findMutualTargets(@Param("userId") Long userId);

    /** 나를 라이벌로 등록한 사람의 id(내 목록의 "서로 라이벌" 표시용). */
    @Query("select r.user.id from Rival r where r.target.id = :userId")
    List<Long> findUserIdsRegistering(@Param("userId") Long userId);

    /**
     * 나를 라이벌로 등록한 "공개 ACTIVE 유저"만, 최근 등록한 순(D63). 이메일·역할 같은 값은 서비스가 DTO로 거른다.
     * 공개 조건(profile_public, ACTIVE, 닉네임 있음)을 목록 쿼리와 count 쿼리 양쪽에 똑같이 건다:
     * count에 조건이 빠지면 totalElements에 비공개 유저 수가 섞여 "숨겨진 사람 수"가 드러나기 때문이다.
     * r.target.id = :me 조회라서 rivals의 ix_rival_target (target_user_id, user_id) 인덱스를 탄다.
     * 정렬은 쿼리에 고정(created_at desc, rival_id desc)이라 요청이 바꿀 수 없다.
     */
    @Query(value = """
            select u from Rival r join r.user u
            where r.target.id = :me and u.profilePublic = true and u.status = :status and u.nickname is not null
            order by r.createdAt desc, r.id desc
            """, countQuery = """
            select count(r) from Rival r join r.user u
            where r.target.id = :me and u.profilePublic = true and u.status = :status and u.nickname is not null
            """)
    Page<User> findPublicRegistrants(@Param("me") Long me, @Param("status") UserStatus status, Pageable pageable);

    @Modifying
    @Query("delete from Rival r where r.user.id = :userId and r.target.id = :targetId")
    int deleteByUserAndTarget(@Param("userId") Long userId, @Param("targetId") Long targetId);
}
