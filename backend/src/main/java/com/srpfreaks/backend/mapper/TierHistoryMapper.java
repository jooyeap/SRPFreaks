package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 곡 상세의 "서열표 변경 이력" 읽기 전용 쿼리 (MyBatis). 쓰기는 하지 않는다. 값은 #{} 바인딩만 쓴다(${} 금지).
 *
 * 왜 새 테이블이 아니라 audit_logs인가: 서열표 값(기준 난이도·속성)을 고칠 때 TableEntryAdminService가 변경 전·후 값을
 * 이미 audit_logs.detail(JSON)에 남기고 있다. 그 로그를 곡 기준으로 다시 읽을 뿐이다. 서열표가 처음 시드될 때의 값에는
 * 로그가 없으므로 이력은 운영자가 고친 뒤부터만 보인다.
 *
 * 보이는 것은 두 가지다. (1) TABLE_ENTRY_CREATE: 서열표에 채보가 추가됨 (2) TABLE_ENTRY_UPDATE 중 기준 난이도 또는 속성이
 * 실제로 바뀐 것. 추천도·레이팅 반영 스위치만 바뀐 로그는 제외한다. `<=>`는 NULL끼리도 같다고 보는 비교라서
 * "값이 없다가 생김/값이 사라짐"도 변경으로 잡는다.
 */
@Mapper
public interface TierHistoryMapper {

    String FROM_WHERE = """
            FROM audit_logs a
            JOIN song_difficulties d
              ON d.song_difficulty_id = JSON_VALUE(a.detail, '$.songDifficultyId' RETURNING UNSIGNED)
            WHERE d.song_id = #{songId}
              AND d.is_deleted = FALSE
              AND (a.action = 'TABLE_ENTRY_CREATE'
                   OR (a.action = 'TABLE_ENTRY_UPDATE'
                       AND (NOT (JSON_VALUE(a.detail, '$.before.tier') <=> JSON_VALUE(a.detail, '$.after.tier'))
                            OR NOT (JSON_VALUE(a.detail, '$.before.pattern') <=> JSON_VALUE(a.detail, '$.after.pattern')))))
            """;

    /** 최신순(같은 시각이면 로그 번호가 큰 것 먼저). limit/offset은 서비스가 상한을 검증해서 넘긴다. */
    @Select("""
            SELECT a.action                                   AS action,
                   a.created_at                               AS changedAt,
                   d.song_difficulty_id                       AS songDifficultyId,
                   d.instrument_part                          AS part,
                   d.difficulty_type                          AS difficulty,
                   d.level                                    AS level,
                   JSON_VALUE(a.detail, '$.before.tier')      AS beforeTier,
                   JSON_VALUE(a.detail, '$.after.tier')       AS afterTier,
                   JSON_VALUE(a.detail, '$.before.pattern')   AS beforePattern,
                   JSON_VALUE(a.detail, '$.after.pattern')    AS afterPattern
            """ + FROM_WHERE + """
            ORDER BY a.created_at DESC, a.audit_log_id DESC
            LIMIT #{limit} OFFSET #{offset}
            """)
    List<TierHistoryRow> findBySong(@Param("songId") Long songId, @Param("limit") int limit, @Param("offset") long offset);

    @Select("SELECT COUNT(*) " + FROM_WHERE)
    long countBySong(@Param("songId") Long songId);
}
