package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.util.List;

/**
 * 세트리스트 추천용 읽기 전용 쿼리 (MyBatis). 쓰기는 하지 않는다. 값은 #{} 바인딩만 쓴다(${} 금지).
 *
 * 왜 MyBatis인가: "서열표 + 채보별 최고 기록(LEFT JOIN, group by) + 이미 담은 줄 제외"를 한 번에 묶는 조회라서
 * JPQL보다 SQL이 읽기 쉽다. 단계(SS/S) 판정과 그룹 나누기, 정렬, 페이지는 서비스(Java)에서 한다 -> 단계 규칙이 한 곳에만 있도록.
 */
@Mapper
public interface SetlistRecommendMapper {

    /**
     * 기준 난이도가 [lo, hi] 안인 레이팅 대상 채보 중, 내 세트리스트에 아직 없는 것.
     *
     * - 레이팅 대상 조건은 SkillMapper와 같다: 기준 난이도가 있고(미정 제외), 속성이 있고 '레이팅 제외'가 아니고,
     *   관리자가 레이팅 반영을 켠 채보이며, 삭제된(소프트 삭제) 곡·채보가 아니다.
     * - 내 기록은 서브쿼리 안에서 user_id + 노트 옵션으로 좁힌 뒤 채보별로 묶는다(남의 기록이 섞이지 않고 인덱스를 탄다).
     *   LEFT JOIN이라 기록이 없는 채보도 나온다(best_rate가 NULL).
     * - NOT EXISTS: 이미 세트리스트에 담은 채보는 추천하지 않는다(user_id 조건 필수).
     */
    @Select("""
            SELECT d.song_difficulty_id AS songDifficultyId,
                   s.song_id            AS songId,
                   s.title              AS title,
                   d.instrument_part    AS part,
                   d.difficulty_type    AS difficulty,
                   d.level              AS level,
                   e.tier_label         AS tier,
                   b.best_rate          AS bestRate,
                   b.full_combo         AS fullCombo
            FROM difficulty_table_entries e
            JOIN song_difficulties d ON d.song_difficulty_id = e.song_difficulty_id
            JOIN songs s ON s.song_id = d.song_id
            LEFT JOIN (
                SELECT r.song_difficulty_id,
                       MAX(r.achievement_rate) AS best_rate,
                       MAX(r.is_full_combo)    AS full_combo
                FROM option_records r
                WHERE r.user_id = #{userId}
                  AND r.note_option = #{noteOption}
                GROUP BY r.song_difficulty_id
            ) b ON b.song_difficulty_id = d.song_difficulty_id
            WHERE e.difficulty_table_id = #{tableId}
              AND d.is_deleted = FALSE
              AND s.is_deleted = FALSE
              AND e.rating_enabled = TRUE
              AND e.tier_label IS NOT NULL
              AND e.tier_label BETWEEN #{lo} AND #{hi}
              AND e.pattern_type IS NOT NULL
              AND e.pattern_type <> #{excludedPattern}
              AND NOT EXISTS (
                  SELECT 1 FROM setlist_items si
                  WHERE si.user_id = #{userId}
                    AND si.song_difficulty_id = d.song_difficulty_id
              )
            """)
    List<RecommendCandidate> findCandidates(@Param("userId") Long userId,
                                            @Param("noteOption") String noteOption,
                                            @Param("tableId") Long tableId,
                                            @Param("excludedPattern") String excludedPattern,
                                            @Param("lo") BigDecimal lo,
                                            @Param("hi") BigDecimal hi);
}
