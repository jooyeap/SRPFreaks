package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 레이팅 계산용 읽기 전용 쿼리 (MyBatis). 쓰기는 하지 않는다.
 *
 * 규칙: 값은 모두 #{} 바인딩만 쓴다. ${}는 쓰지 않는다(SQL 인젝션 방지). 정렬·필터를 요청 값으로 받지도 않는다.
 *
 * 왜 MyBatis인가: "채보별 최고 기록(group by) + 서열표 + 곡"을 한 번에 묶는 집계라서
 * JPQL보다 SQL이 읽기 쉽고 결과 모양(RatingCandidate)을 직접 정할 수 있다.
 * 수식(V)과 상위 N 선택은 SQL이 아니라 서비스(Java)에서 한다 -> 수식의 모양이 코드 한 곳에만 있도록.
 */
@Mapper
public interface SkillMapper {

    /**
     * 레이팅 후보: 본인이 해당 노트 옵션으로 기록을 남겼고, 서열표에 기준 난이도와 속성이 모두 있는 채보.
     *
     * - 안쪽 b: 사용자 + 노트 옵션으로 좁힌 뒤 채보별 최고 달성률과 FC 여부(하나라도 FC면 1)를 구한다.
     *   user_id를 서브쿼리 안에서 거는 이유: 다른 사용자의 기록이 집계에 섞이지 않게 하고 인덱스(user_id, ...)를 탄다.
     * - tier_label IS NOT NULL: 기준 난이도가 없는 채보(미정)는 레이팅 대상이 아니다.
     * - pattern_type IS NOT NULL AND <> #{excludedPattern}: 속성이 없거나 '레이팅 제외'인 채보는 어느 그룹에도 안 들어간다.
     *   '레이팅 제외' 문자열은 SQL에 박지 않고 enum 라벨을 바인딩한다.
     * - 삭제된(소프트 삭제) 곡·채보는 제외한다.
     * - achievedAt: 그 최고 달성률을 "처음" 기록한 시각(같은 점수를 여러 번 냈으면 가장 이른 것). 유저 목록 동점 처리용(D26).
     */
    @Select("""
            SELECT d.song_difficulty_id AS songDifficultyId,
                   s.song_id            AS songId,
                   s.title              AS title,
                   d.instrument_part    AS part,
                   d.difficulty_type    AS difficulty,
                   d.level              AS level,
                   e.tier_label         AS tier,
                   e.pattern_type       AS pattern,
                   b.best_rate          AS bestRate,
                   b.full_combo         AS fullCombo,
                   (SELECT MIN(r2.played_at)
                      FROM option_records r2
                     WHERE r2.user_id = #{userId}
                       AND r2.note_option = #{noteOption}
                       AND r2.song_difficulty_id = b.song_difficulty_id
                       AND r2.achievement_rate = b.best_rate) AS achievedAt
            FROM (
                SELECT r.song_difficulty_id,
                       MAX(r.achievement_rate) AS best_rate,
                       MAX(r.is_full_combo)    AS full_combo
                FROM option_records r
                WHERE r.user_id = #{userId}
                  AND r.note_option = #{noteOption}
                GROUP BY r.song_difficulty_id
            ) b
            JOIN song_difficulties d ON d.song_difficulty_id = b.song_difficulty_id
            JOIN songs s ON s.song_id = d.song_id
            JOIN difficulty_table_entries e
                 ON e.song_difficulty_id = d.song_difficulty_id
                AND e.difficulty_table_id = #{tableId}
            WHERE d.is_deleted = FALSE
              AND s.is_deleted = FALSE
              AND e.tier_label IS NOT NULL
              AND e.pattern_type IS NOT NULL
              AND e.pattern_type <> #{excludedPattern}
            """)
    List<RatingCandidate> findRatingCandidates(@Param("userId") Long userId,
                                               @Param("noteOption") String noteOption,
                                               @Param("tableId") Long tableId,
                                               @Param("excludedPattern") String excludedPattern);
}
