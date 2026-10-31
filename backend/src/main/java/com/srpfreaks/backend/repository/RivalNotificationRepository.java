package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.RivalNotificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RivalNotificationRepository extends JpaRepository<RivalNotification, Long> {

    /** 같은 (받는 사람, 역전한 사람, 채보)의 아직 안 보인 알림. 10분 안에 다시 저장하면 이 줄을 고친다. */
    Optional<RivalNotification> findFirstByRecipient_IdAndActor_IdAndSongDifficulty_IdAndStatus(
            Long recipientId, Long actorId, Long songDifficultyId, RivalNotificationStatus status);

    /** 보일 시각이 지난 PENDING(받는 사람이 알림을 읽을 때 처리한다). 오래된 것부터. */
    @Query("""
            select n from RivalNotification n join fetch n.actor
            where n.recipient.id = :recipientId and n.status = com.srpfreaks.backend.entity.RivalNotificationStatus.PENDING
              and n.visibleAt <= :now
            order by n.visibleAt asc, n.id asc
            """)
    List<RivalNotification> findDue(@Param("recipientId") Long recipientId, @Param("now") Instant now);

    /** 그날 한 상대에게서 따로(묶음 아님) 보인 알림 수. 하루 개수 판단용. */
    long countByRecipient_IdAndActor_IdAndAlertDateAndBundledFalseAndStatus(
            Long recipientId, Long actorId, LocalDate alertDate, RivalNotificationStatus status);

    /** 그날 한 상대의 묶음 줄. */
    Optional<RivalNotification> findFirstByRecipient_IdAndActor_IdAndAlertDateAndBundledTrue(
            Long recipientId, Long actorId, LocalDate alertDate);

    long countByRecipient_IdAndStatusAndReadAtIsNull(Long recipientId, RivalNotificationStatus status);

    /** 보이는 알림 목록. 역전한 사람·채보·곡을 함께 읽는다(줄마다 따로 읽으면 N+1). to-one만이라 페이징과 함께 써도 안전하다. */
    @EntityGraph(attributePaths = {"actor", "songDifficulty", "songDifficulty.song"})
    Page<RivalNotification> findByRecipient_IdAndStatus(Long recipientId, RivalNotificationStatus status, Pageable pageable);

    Optional<RivalNotification> findByIdAndRecipient_IdAndStatus(Long id, Long recipientId, RivalNotificationStatus status);

    @Modifying
    @Query("""
            update RivalNotification n set n.readAt = :now
            where n.recipient.id = :recipientId and n.status = com.srpfreaks.backend.entity.RivalNotificationStatus.SHOWN
              and n.readAt is null
            """)
    int markAllRead(@Param("recipientId") Long recipientId, @Param("now") Instant now);

    /** 보관 기간이 지난 알림을 지운다(30일). 모든 사람 것을 한 번에 지운다(created_at 인덱스). */
    @Modifying
    @Query("delete from RivalNotification n where n.createdAt < :before")
    int deleteOlderThan(@Param("before") Instant before);
}
