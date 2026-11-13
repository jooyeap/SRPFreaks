package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.UserList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/** 내 리스트 조회/저장 (D76). 모든 조회에 user_id 조건이 걸려 남의 리스트는 id를 알아도 찾을 수 없다. */
public interface UserListRepository extends JpaRepository<UserList, Long> {

    Page<UserList> findByUserId(Long userId, Pageable pageable);

    Optional<UserList> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);

    /** 새 리스트를 맨 뒤에 두려고 쓰는 가장 큰 순서값(리스트가 없으면 null). */
    @Query("select max(l.sortOrder) from UserList l where l.user.id = :userId")
    Integer findMaxSortOrder(@Param("userId") Long userId);

    /**
     * 같은 이름(대소문자 구분 없이)의 다른 리스트 수. excludeId는 이름을 바꿀 때 자기 자신을 빼려는 값(만들 때는 null).
     * DB의 UNIQUE(user_id, name)도 utf8mb4_unicode_ci라 같은 기준이지만, 대소문자 기준을 코드에서도 분명히 해 둔다.
     */
    @Query("""
            select count(l) from UserList l
            where l.user.id = :userId and lower(l.name) = lower(:name)
              and (:excludeId is null or l.id <> :excludeId)
            """)
    long countSameName(@Param("userId") Long userId, @Param("name") String name, @Param("excludeId") Long excludeId);
}
