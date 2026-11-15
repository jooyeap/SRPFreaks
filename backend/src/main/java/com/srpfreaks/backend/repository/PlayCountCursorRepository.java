package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.PlayCountCursor;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/** 가져오기 집계 커서 (D84). */
public interface PlayCountCursorRepository extends JpaRepository<PlayCountCursor, Long> {

    /** 줄이 없으면 빈 커서(시각 없음)를 만들고, 있으면 아무것도 하지 않는다. 동시에 불러도 유일 키가 한 줄로 합친다. */
    @Modifying
    @Query(value = """
            insert into play_count_cursors (user_id, last_counted_at, created_at, updated_at)
            values (:userId, null, utc_timestamp(6), utc_timestamp(6))
            on duplicate key update user_id = user_id
            """, nativeQuery = true)
    int ensureExists(@Param("userId") Long userId);

    /**
     * 읽고 → 센 뒤 → 옮기는 사이에 같은 사용자의 다른 가져오기가 끼어들면 같은 플레이를 둘 다 새것으로 보고 두 번 센다.
     * 행 잠금(select ... for update)으로 같은 사용자의 집계를 한 줄로 세워 이를 막는다. 잠금은 집계 트랜잭션이 끝나면 풀린다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PlayCountCursor c where c.userId = :userId")
    Optional<PlayCountCursor> findForUpdate(@Param("userId") Long userId);
}
