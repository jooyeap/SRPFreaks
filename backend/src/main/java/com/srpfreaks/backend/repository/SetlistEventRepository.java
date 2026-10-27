package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.SetlistEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 세트리스트 이력 (D52). */
public interface SetlistEventRepository extends JpaRepository<SetlistEvent, Long> {

    /**
     * 같은 (사용자, 채보, 종류, 날짜)가 이미 있으면 아무것도 하지 않고 넘어간다(반환 0).
     * 왜 save가 아니라 이 쿼리인가: 같은 날 담기를 연달아 눌러 두 요청이 동시에 들어오면 둘 다 "없음"을 보고 insert를 시도한다.
     * save였다면 한쪽이 유일 키 위반으로 터져 바깥 트랜잭션(= 세트리스트 담기 자체)까지 롤백된다.
     * ON DUPLICATE KEY UPDATE로 충돌을 DB 안에서 흡수하면 로그가 담기/빼기를 절대 막지 못한다.
     */
    @Modifying
    @Query(value = """
            insert into setlist_events (user_id, song_difficulty_id, event_type, event_date, average_level, created_at, updated_at)
            values (:userId, :chartId, :eventType, :eventDate, :averageLevel, utc_timestamp(6), utc_timestamp(6))
            on duplicate key update setlist_event_id = setlist_event_id
            """, nativeQuery = true)
    int insertIfAbsent(@Param("userId") Long userId, @Param("chartId") Long chartId, @Param("eventType") String eventType,
                       @Param("eventDate") LocalDate eventDate, @Param("averageLevel") BigDecimal averageLevel);
}
