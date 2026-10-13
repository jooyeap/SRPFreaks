package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.SkillSnapshot;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 스냅샷 한 줄. date는 Asia/Seoul 기준 날짜. change = 바로 이전 스냅샷 대비 합계 증감(첫 스냅샷이면 null).
 */
public record SkillSnapshotResponse(Long id, LocalDate date, BigDecimal totalScore, BigDecimal singleScore,
                                    BigDecimal otherScore, BigDecimal change) {

    public static SkillSnapshotResponse from(SkillSnapshot snapshot, SkillSnapshot previous) {
        BigDecimal change = previous == null ? null : snapshot.getTotalScore().subtract(previous.getTotalScore());
        return new SkillSnapshotResponse(snapshot.getId(), snapshot.getSnapshotDate(), snapshot.getTotalScore(),
                snapshot.getSingleScore(), snapshot.getOtherScore(), change);
    }
}
