package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.ChartPlayCount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

/** 플레이 횟수 (D84). 쓰기는 addPlays 하나뿐이다(JPA 쪽 네이티브 upsert, MyBatis 쓰기 없음). */
public interface ChartPlayCountRepository extends JpaRepository<ChartPlayCount, Long> {

    Optional<ChartPlayCount> findByUser_IdAndSongDifficulty_Id(Long userId, Long songDifficultyId);

    /**
     * (사용자, 채보)의 횟수를 delta만큼 올린다. 줄이 없으면 만든다.
     * 왜 "읽고 +1 하고 save"가 아닌가: 같은 사용자의 입력이 동시에 두 번 들어오면 둘 다 같은 값을 읽어 한 번이 사라진다.
     * ON DUPLICATE KEY UPDATE는 증가를 DB 안에서 한 문장으로 처리해 그 경쟁이 없고, 첫 insert끼리 충돌해도 유일 키가 한쪽을 update로 돌린다.
     * last_played_at은 더 늦은 값만 남긴다(이른 플레이를 나중에 넣어도 뒤로 가지 않음). 값은 모두 바인딩 파라미터다.
     */
    @Modifying
    @Query(value = """
            insert into chart_play_counts (user_id, song_difficulty_id, play_count, last_played_at, created_at, updated_at)
            values (:userId, :chartId, :delta, :playedAt, utc_timestamp(6), utc_timestamp(6)) as incoming
            on duplicate key update
                play_count = chart_play_counts.play_count + incoming.play_count,
                last_played_at = greatest(coalesce(chart_play_counts.last_played_at, incoming.last_played_at), incoming.last_played_at),
                updated_at = utc_timestamp(6)
            """, nativeQuery = true)
    int addPlays(@Param("userId") Long userId, @Param("chartId") Long chartId, @Param("delta") int delta,
                 @Param("playedAt") Instant playedAt);
}
