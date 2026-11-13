package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

/**
 * 같은 티어 유저 기록(D53) 집계용 읽기 전용 쿼리 (MyBatis). 쓰기는 하지 않는다. 값은 #{} 바인딩만 쓴다(${} 금지).
 *
 * 왜 MyBatis인가: "유저마다 티어 구간 안에서 총점이 가장 높은 스냅샷 하나만 고르고(상관 서브쿼리), 그 스냅샷들의 채보 줄을 모은다"는
 * 집계라서 JPQL보다 SQL이 읽기 쉽다. 중앙값·표시 기준·상승 예상 점수는 서비스(Java)에서 계산한다 -> 수식이 한 곳에만 있도록.
 *
 * 응답에 유저 식별 정보는 나가지 않는다. 쿼리도 달성률 줄만 돌려주고 user_id는 select 하지 않는다.
 */
@Mapper
public interface PeerStatsMapper {

    /**
     * 집계에 쓸 스냅샷 id 목록(서브쿼리 조각). 규칙:
     * - 공개(profile_public)이고 차단되지 않은 유저만, 나(#{userId})는 뺀다. 공개를 끄거나 탈퇴하면 다음 계산부터 바로 빠진다.
     * - 총점이 [lo, hi) 구간 안인 스냅샷만 본다(내 티어 구간). 그 안에서 유저마다 총점이 가장 높은 것 1개(A안).
     *   총점이 같으면 더 최근 날짜. (유저, 옵션, 날짜)가 유일 키라 날짜까지 같을 수는 없다.
     * - 곡별 상세(skill_snapshot_entries)가 없는 옛 스냅샷은 건너뛴다(비교할 채보가 없다). "가장 높은 것"을 고를 때도 같은 조건을 건다.
     * - XML 스크립트 안에서 쓰므로 '<' 문자를 쓰지 않는다(#{hi} > 값 처럼 방향을 뒤집었다).
     */
    String CHOSEN_SNAPSHOTS = """
            SELECT s.skill_snapshot_id
            FROM skill_snapshots s
            JOIN users u ON u.user_id = s.user_id
            WHERE u.profile_public = TRUE
              AND u.status = 'ACTIVE'
              AND s.user_id != #{userId}
              AND s.note_option = #{noteOption}
              AND s.total_score >= #{lo}
              AND #{hi} > s.total_score
              AND EXISTS (SELECT 1 FROM skill_snapshot_entries x WHERE x.skill_snapshot_id = s.skill_snapshot_id)
              AND NOT EXISTS (
                  SELECT 1 FROM skill_snapshots t
                  WHERE t.user_id = s.user_id
                    AND t.note_option = s.note_option
                    AND t.total_score >= #{lo}
                    AND #{hi} > t.total_score
                    AND EXISTS (SELECT 1 FROM skill_snapshot_entries y WHERE y.skill_snapshot_id = t.skill_snapshot_id)
                    AND (t.total_score > s.total_score
                         OR (t.total_score = s.total_score AND t.snapshot_date > s.snapshot_date))
              )
            """;

    /** 집계에 쓰인 유저 수(= 고른 스냅샷 수, 유저당 1개). 화면의 "공개 유저 n명"의 n. */
    @Select("SELECT COUNT(*) FROM (" + CHOSEN_SNAPSHOTS + ") picked")
    int countBandUsers(@Param("userId") Long userId,
                       @Param("noteOption") String noteOption,
                       @Param("lo") BigDecimal lo,
                       @Param("hi") BigDecimal hi);

    /** 고른 스냅샷들의 레이팅 목록 중, 물어본 채보들의 달성률(채보당 유저 수만큼 줄이 나온다). */
    @Select("""
            <script>
            SELECT e.song_difficulty_id AS songDifficultyId,
                   e.achievement_rate   AS rate
            FROM skill_snapshot_entries e
            WHERE e.skill_snapshot_id IN (""" + CHOSEN_SNAPSHOTS + """
            )
              AND e.song_difficulty_id IN
              <foreach collection="chartIds" item="chartId" open="(" separator="," close=")">#{chartId}</foreach>
            </script>
            """)
    List<PeerChartRate> findChartRates(@Param("userId") Long userId,
                                       @Param("noteOption") String noteOption,
                                       @Param("lo") BigDecimal lo,
                                       @Param("hi") BigDecimal hi,
                                       @Param("chartIds") Collection<Long> chartIds);

    /**
     * 물어본 채보의 서열표 값. 레이팅 대상 조건은 SkillMapper와 같다(기준 난이도·속성이 있고 '레이팅 제외'가 아니며,
     * 레이팅 반영이 켜져 있고, 삭제되지 않은 곡·채보). 조건에 안 맞는 채보는 나오지 않는다 -> 서비스가 상승 예상 점수를 비운다.
     */
    @Select("""
            <script>
            SELECT e.song_difficulty_id AS songDifficultyId,
                   e.tier_label         AS tier,
                   e.pattern_type       AS pattern
            FROM difficulty_table_entries e
            JOIN song_difficulties d ON d.song_difficulty_id = e.song_difficulty_id
            JOIN songs s ON s.song_id = d.song_id
            WHERE e.difficulty_table_id = #{tableId}
              AND d.is_deleted = FALSE
              AND s.is_deleted = FALSE
              AND e.rating_enabled = TRUE
              AND e.tier_label IS NOT NULL
              AND e.pattern_type IS NOT NULL
              AND e.pattern_type != #{excludedPattern}
              AND e.song_difficulty_id IN
              <foreach collection="chartIds" item="chartId" open="(" separator="," close=")">#{chartId}</foreach>
            </script>
            """)
    List<PeerChartMeta> findChartMeta(@Param("tableId") Long tableId,
                                      @Param("excludedPattern") String excludedPattern,
                                      @Param("chartIds") Collection<Long> chartIds);

    /**
     * 약점 분석(D72)용: 고른 스냅샷들의 레이팅 목록을 속성별로 묶은 집계. 복합(단일)은 복합과 같은 묶음으로 센다.
     * 돌려주는 것은 묶음별 유저 수(스냅샷은 유저당 1개라 서로 다른 스냅샷 수 = 유저 수) · 줄 수 · 평균 달성률뿐이다.
     * user_id·개별 달성률은 select 하지 않는다(개인이 드러나지 않는 집계값만, D53). 최소 인원 검사는 서비스가 한다.
     * 안쪽 쿼리(t)에서 묶음 값을 먼저 만든 뒤 바깥에서 GROUP BY 하는 이유: SELECT와 GROUP BY에 같은 CASE 식을 따로 쓰면
     * 바인딩 값(#{})이 달라 보여 ONLY_FULL_GROUP_BY 오류가 날 수 있다. 서열표 값(속성)은 채보 마스터에서 읽는다(레이팅 대상 조건은 findChartMeta와 같다).
     */
    @Select("""
            SELECT agg.pattern_group AS pattern,
                   COUNT(DISTINCT agg.snapshot_id) AS users,
                   COUNT(*) AS entries,
                   AVG(agg.rate) AS avgRate
            FROM (
                SELECT x.skill_snapshot_id AS snapshot_id,
                       x.achievement_rate  AS rate,
                       CASE WHEN e.pattern_type = #{compositeSingle} THEN #{compound} ELSE e.pattern_type END AS pattern_group
                FROM skill_snapshot_entries x
                JOIN difficulty_table_entries e ON e.song_difficulty_id = x.song_difficulty_id
                                               AND e.difficulty_table_id = #{tableId}
                JOIN song_difficulties d ON d.song_difficulty_id = x.song_difficulty_id
                JOIN songs s ON s.song_id = d.song_id
                WHERE x.skill_snapshot_id IN (""" + CHOSEN_SNAPSHOTS + """
                )
                  AND d.is_deleted = FALSE
                  AND s.is_deleted = FALSE
                  AND e.rating_enabled = TRUE
                  AND e.tier_label IS NOT NULL
                  AND e.pattern_type IS NOT NULL
                  AND e.pattern_type != #{excludedPattern}
            ) agg
            GROUP BY agg.pattern_group
            """)
    List<PeerGroupAverage> findPatternAverages(@Param("userId") Long userId,
                                               @Param("noteOption") String noteOption,
                                               @Param("lo") BigDecimal lo,
                                               @Param("hi") BigDecimal hi,
                                               @Param("tableId") Long tableId,
                                               @Param("excludedPattern") String excludedPattern,
                                               @Param("compositeSingle") String compositeSingle,
                                               @Param("compound") String compound);

    /**
     * 약점 분석(D72)용: 서열표 기준 난이도 묶음(bandWidth 단위, 예 0.5 -> 5.5~5.9)별 집계. 묶음 값 = FLOOR(기준 난이도 / 폭) x 폭.
     * 나머지 규칙은 findPatternAverages와 같다. 폭은 서버 상수가 #{}로 들어오고 요청에서 오지 않는다.
     */
    @Select("""
            SELECT agg.band AS band,
                   COUNT(DISTINCT agg.snapshot_id) AS users,
                   COUNT(*) AS entries,
                   AVG(agg.rate) AS avgRate
            FROM (
                SELECT x.skill_snapshot_id AS snapshot_id,
                       x.achievement_rate  AS rate,
                       FLOOR(e.tier_label / #{bandWidth}) * #{bandWidth} AS band
                FROM skill_snapshot_entries x
                JOIN difficulty_table_entries e ON e.song_difficulty_id = x.song_difficulty_id
                                               AND e.difficulty_table_id = #{tableId}
                JOIN song_difficulties d ON d.song_difficulty_id = x.song_difficulty_id
                JOIN songs s ON s.song_id = d.song_id
                WHERE x.skill_snapshot_id IN (""" + CHOSEN_SNAPSHOTS + """
                )
                  AND d.is_deleted = FALSE
                  AND s.is_deleted = FALSE
                  AND e.rating_enabled = TRUE
                  AND e.tier_label IS NOT NULL
                  AND e.pattern_type IS NOT NULL
                  AND e.pattern_type != #{excludedPattern}
            ) agg
            GROUP BY agg.band
            """)
    List<PeerBandAverage> findBandAverages(@Param("userId") Long userId,
                                           @Param("noteOption") String noteOption,
                                           @Param("lo") BigDecimal lo,
                                           @Param("hi") BigDecimal hi,
                                           @Param("tableId") Long tableId,
                                           @Param("excludedPattern") String excludedPattern,
                                           @Param("bandWidth") BigDecimal bandWidth);
}
