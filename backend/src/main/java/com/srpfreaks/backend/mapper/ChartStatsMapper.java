package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 서열표 분석(D77) 읽기 전용 쿼리 (MyBatis). 쓰기는 하지 않는다. 값은 #{} 바인딩만 쓴다(${} 금지). 정렬은 SQL에 두지 않고
 * 서비스가 허용된 값(화이트리스트)만 받아 메모리에서 한다(채보가 수백 개라 충분하고, 폴더 평균·편차는 SQL이 아니라 한 곳(ChartStatsCalculator)에서 낸다).
 *
 * 개인정보 설계의 핵심: 모든 쿼리는 아래 PUBLIC_RECORDS 한 조각에서 출발한다.
 * 그래서 "공개(profile_public) + ACTIVE + 닉네임 있음 + SRN+ 기록" 조건이 목록·인원·평균·유저 목록에 똑같이 걸린다(D74와 같은 원칙).
 * 비공개·차단·탈퇴 유저는 이 조각 안에 없으므로 어떤 숫자에도 섞이지 않는다. 삭제된 기록은 DB에서 지워지므로(option_records에는 is_deleted가 없다) 자동으로 없다.
 * 이메일·역할·Google ID는 select 하지 않는다.
 *
 * 한 유저가 한 채보에 여러 번 저장해도 ROLLUP 안에서 (유저, 채보)당 한 줄(최고 달성률)로 접히므로 평균에는 그 유저의 최고 1개만 들어간다.
 */
@Mapper
public interface ChartStatsMapper {

    /** 집계 대상 기록: 공개 + ACTIVE 유저의 레이팅 옵션(SRN+) 기록. 아래 ROLLUP들이 뒤에 GROUP BY를 붙인다. '<' 문자를 쓰지 않는다. */
    String PUBLIC_RECORDS = """
            FROM option_records r
            JOIN users u ON u.user_id = r.user_id
            WHERE u.profile_public = TRUE
              AND u.status = 'ACTIVE'
              AND u.nickname IS NOT NULL
              AND r.note_option = #{noteOption}
            """;

    String ROLLUP_COLUMNS = """
            SELECT r.user_id AS user_id,
                   r.song_difficulty_id AS song_difficulty_id,
                   MAX(r.achievement_rate) AS best_rate,
                   COUNT(*) AS play_count,
                   SUM(CASE WHEN r.created_at >= #{since} THEN 1 ELSE 0 END) AS recent_count,
                   MAX(r.played_at) AS last_played_at
            """;

    String ROLLUP_GROUP = " GROUP BY r.user_id, r.song_difficulty_id ";

    /** (유저, 채보)당 한 줄: 최고 달성률 · 저장 횟수 · 최근 저장 횟수 · 마지막 플레이. 전체 채보. */
    String ROLLUP_ALL = ROLLUP_COLUMNS + PUBLIC_RECORDS + ROLLUP_GROUP;

    /** 같은 모양이고 채보 하나만. */
    String ROLLUP_ONE = ROLLUP_COLUMNS + PUBLIC_RECORDS + " AND r.song_difficulty_id = #{songDifficultyId} " + ROLLUP_GROUP;

    /**
     * 채보별 집계(기록이 있는 채보만). 서열표 기준 난이도(tier)는 레이팅 서열표(tableId)에서 가져오고, 서열표에 없거나 기준 난이도가 비어 있으면 null(미정).
     * tableId가 null(레이팅 서열표 없음)이면 LEFT JOIN이 맞지 않아 모두 미정이다. 삭제된 곡·채보는 뺀다.
     */
    @Select("""
            SELECT d.song_difficulty_id AS songDifficultyId,
                   s.song_id            AS songId,
                   s.title              AS title,
                   d.instrument_part    AS part,
                   d.difficulty_type    AS difficulty,
                   d.level              AS level,
                   e.tier_label         AS tier,
                   a.players            AS players,
                   a.records            AS records,
                   a.sum_rate           AS sumRate,
                   a.recent_records     AS recentRecords
            FROM (
                SELECT b.song_difficulty_id AS song_difficulty_id,
                       COUNT(*)             AS players,
                       SUM(b.play_count)    AS records,
                       SUM(b.best_rate)     AS sum_rate,
                       SUM(b.recent_count)  AS recent_records
                FROM (""" + ROLLUP_ALL + """
                ) b
                GROUP BY b.song_difficulty_id
            ) a
            JOIN song_difficulties d ON d.song_difficulty_id = a.song_difficulty_id
            JOIN songs s ON s.song_id = d.song_id
            LEFT JOIN difficulty_table_entries e
                   ON e.song_difficulty_id = d.song_difficulty_id
                  AND e.difficulty_table_id = #{tableId,jdbcType=BIGINT}
            WHERE d.is_deleted = FALSE
              AND s.is_deleted = FALSE
            """)
    List<ChartAggregateRow> findChartAggregates(@Param("noteOption") String noteOption,
                                                @Param("tableId") Long tableId,
                                                @Param("since") LocalDateTime since);

    /** 채보 하나의 공개 유저 줄(유저 목록·요약용). 닉네임은 유저 목록(D26)에서 이미 보이는 값이다. */
    @Select("""
            SELECT b.user_id AS userId,
                   u.nickname AS nickname,
                   b.best_rate AS bestRate,
                   b.play_count AS playCount,
                   b.last_played_at AS lastPlayedAt
            FROM (""" + ROLLUP_ONE + """
            ) b
            JOIN users u ON u.user_id = b.user_id
            """)
    List<ChartPlayerRow> findPlayerRows(@Param("noteOption") String noteOption,
                                        @Param("songDifficultyId") Long songDifficultyId,
                                        @Param("since") LocalDateTime since);

    /** 채보 하나의 이름과 서열표 기준 난이도. 없거나 삭제된 곡·채보면 null. */
    @Select("""
            SELECT d.song_difficulty_id AS songDifficultyId,
                   s.song_id            AS songId,
                   s.title              AS title,
                   d.instrument_part    AS part,
                   d.difficulty_type    AS difficulty,
                   d.level              AS level,
                   e.tier_label         AS tier
            FROM song_difficulties d
            JOIN songs s ON s.song_id = d.song_id
            LEFT JOIN difficulty_table_entries e
                   ON e.song_difficulty_id = d.song_difficulty_id
                  AND e.difficulty_table_id = #{tableId,jdbcType=BIGINT}
            WHERE d.song_difficulty_id = #{songDifficultyId}
              AND d.is_deleted = FALSE
              AND s.is_deleted = FALSE
            """)
    ChartInfoRow findChartInfo(@Param("songDifficultyId") Long songDifficultyId, @Param("tableId") Long tableId);

    /** 서열표 폴더(기준 난이도)별 채보 수. 기준 난이도가 없는(미정) 채보는 폴더가 아니라서 세지 않는다. */
    @Select("""
            SELECT e.tier_label AS tier,
                   COUNT(*)     AS chartCount
            FROM difficulty_table_entries e
            JOIN song_difficulties d ON d.song_difficulty_id = e.song_difficulty_id
            JOIN songs s ON s.song_id = d.song_id
            WHERE e.difficulty_table_id = #{tableId}
              AND e.tier_label IS NOT NULL
              AND d.is_deleted = FALSE
              AND s.is_deleted = FALSE
            GROUP BY e.tier_label
            """)
    List<FolderChartCountRow> findFolderChartCounts(@Param("tableId") Long tableId);

    /** 집계 기준에 들어가는 공개 유저 수("공개 프로필 N명 기준"의 N). 공개 + ACTIVE + 닉네임 있는 유저만 센다. */
    @Select("""
            SELECT COUNT(*)
            FROM users u
            WHERE u.profile_public = TRUE
              AND u.status = 'ACTIVE'
              AND u.nickname IS NOT NULL
            """)
    int countPublicUsers();
}
