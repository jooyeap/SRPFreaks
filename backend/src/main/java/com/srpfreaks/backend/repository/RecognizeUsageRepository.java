package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.RecognizeUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

/** 사진 입력(D55) 사용 기록. 두 인덱스(user_id+used_at, used_at)로 개수만 센다. */
public interface RecognizeUsageRepository extends JpaRepository<RecognizeUsage, Long> {

    /** 이 사용자가 since 이후(포함하지 않음)에 쓴 장수. 최근 7일 한도에 쓴다. */
    long countByUser_IdAndUsedAtAfter(Long userId, Instant since);

    /** 전체 사용자가 since 이후(포함)에 쓴 장수. 하루 전체 한도에 쓴다. */
    long countByUsedAtGreaterThanEqual(Instant since);

    /** 한도 안에서 가장 오래된 사용. 이 시각 + 7일이 되면 한 장이 다시 생긴다. */
    Optional<RecognizeUsage> findFirstByUser_IdAndUsedAtAfterOrderByUsedAtAsc(Long userId, Instant since);

    /** 오래된 줄 정리(8일 지난 것). 한 번의 DELETE로 지운다. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM RecognizeUsage u WHERE u.usedAt < :before")
    int deleteOlderThan(@Param("before") Instant before);
}
