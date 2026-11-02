package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.TierNotification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TierNotificationRepository extends JpaRepository<TierNotification, Long> {

    long countByUser_IdAndReadAtIsNull(Long userId);

    /** 알림 목록에 보일 줄을 id로 읽는다. 채보·곡을 함께 읽는다(줄마다 따로 읽으면 N+1). 본인 것만. */
    @EntityGraph(attributePaths = {"songDifficulty", "songDifficulty.song"})
    List<TierNotification> findByUser_IdAndIdIn(Long userId, Collection<Long> ids);

    Optional<TierNotification> findByIdAndUser_Id(Long id, Long userId);

    @Modifying
    @Query("update TierNotification n set n.readAt = :now where n.user.id = :userId and n.readAt is null")
    int markAllRead(@Param("userId") Long userId, @Param("now") Instant now);

    /** 보관 기간이 지난 알림을 지운다. 모든 사람 것을 한 번에 지운다(created_at 인덱스). */
    @Modifying
    @Query("delete from TierNotification n where n.createdAt < :before")
    int deleteOlderThan(@Param("before") Instant before);
}
