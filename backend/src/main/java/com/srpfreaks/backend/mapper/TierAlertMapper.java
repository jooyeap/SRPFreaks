package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 서열표 변경 알림(D61)의 후보 읽기 전용 쿼리. 쓰기는 하지 않고 #{}만 쓴다.
 *
 * 서열표 변경 탭(TierChangeMapper, D58)과 같은 audit_logs를 읽지만 조건이 더 좁다.
 * (1) 기준 난이도(tier)가 실제로 바뀐 로그만. 속성·추천·레이팅 반영 스위치만 바뀐 로그는 그 채보의 내 점수를 바꾸지 않으므로 뺀다.
 *     `<=>`는 NULL끼리도 같다고 보는 비교라, 미정 -> 값 / 값 -> 미정도 "바뀜"으로 잡힌다.
 *     새로 추가된 줄(TABLE_ENTRY_CREATE)은 before가 없어 before.tier가 NULL이므로, after.tier가 있을 때만 잡힌다.
 * (2) 내가 그 채보에 레이팅 옵션(SRN+) 기록이 있을 때만. JOIN으로 거르고 그 채보의 내 최고 달성률을 같이 읽는다.
 *     실제 점수가 달라졌는지(달성률 0이면 전·후 모두 0점)는 수식이 있는 서비스(RatingCalculator)가 판단한다.
 */
@Mapper
public interface TierAlertMapper {

    /** 지금까지 쌓인 감사 로그의 최대 번호(없으면 0). 커서의 끝으로 쓴다. */
    @Select("SELECT COALESCE(MAX(audit_log_id), 0) FROM audit_logs")
    long maxAuditLogId();

    /**
     * 커서 뒤(afterId 초과, upToId 이하)의 기준 난이도 변경 중 내가 기록한 채보의 것. 로그 번호 순.
     * since보다 오래된 변경(보관 기간 밖)은 알림으로 만들지 않는다.
     *
     * GROUP BY: 한 채보에 내 기록이 여러 줄이라 JOIN하면 로그 한 건이 여러 줄이 된다. 로그(PK)와 채보로 묶어 최고 달성률만 남긴다.
     * a.detail·a.created_at은 a의 PK(audit_log_id)에 함수 종속이라 ONLY_FULL_GROUP_BY에서도 그대로 고를 수 있다.
     */
    @Select("""
            SELECT a.audit_log_id                         AS auditLogId,
                   a.created_at                           AS changedAt,
                   d.song_difficulty_id                   AS songDifficultyId,
                   JSON_VALUE(a.detail, '$.before.tier')  AS beforeTier,
                   JSON_VALUE(a.detail, '$.after.tier')   AS afterTier,
                   MAX(r.achievement_rate)                AS myRate
            FROM audit_logs a
            JOIN song_difficulties d
              ON d.song_difficulty_id = JSON_VALUE(a.detail, '$.songDifficultyId' RETURNING UNSIGNED)
            JOIN songs s ON s.song_id = d.song_id
            JOIN option_records r
              ON r.song_difficulty_id = d.song_difficulty_id
             AND r.user_id = #{userId}
             AND r.note_option = #{noteOption}
            WHERE a.audit_log_id > #{afterId}
              AND a.audit_log_id <= #{upToId}
              AND a.created_at >= #{since}
              AND a.action IN ('TABLE_ENTRY_CREATE', 'TABLE_ENTRY_UPDATE')
              AND NOT (JSON_VALUE(a.detail, '$.before.tier') <=> JSON_VALUE(a.detail, '$.after.tier'))
              AND d.is_deleted = FALSE
              AND s.is_deleted = FALSE
            GROUP BY a.audit_log_id, d.song_difficulty_id
            ORDER BY a.audit_log_id
            """)
    List<TierAlertRow> findChanges(@Param("userId") Long userId, @Param("noteOption") String noteOption,
                                   @Param("afterId") long afterId, @Param("upToId") long upToId,
                                   @Param("since") LocalDateTime since);
}
