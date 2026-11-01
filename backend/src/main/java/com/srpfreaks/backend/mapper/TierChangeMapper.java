package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 사이트 전체의 서열표 변경 목록(D58, 공지 화면 `서열표 변경` 탭) 읽기 전용 쿼리. 쓰기는 하지 않고 #{}만 쓴다.
 *
 * 곡 상세 이력(TierHistoryMapper, D45)과 같은 audit_logs를 곡 구분 없이 읽는다. 차이는 두 가지다.
 * (1) 추천도만 바뀐 수정도 보인다(운영자가 공지를 따로 쓰지 않도록 이 목록이 공지를 대신하므로).
 * (2) 곡명을 같이 내보낸다. 레이팅 반영 스위치만 바뀐 로그는 여전히 뺀다.
 * 삭제된 곡·채보의 로그는 보이지 않는다. `<=>`는 NULL끼리도 같다고 보는 비교라 "값이 생김/사라짐"도 변경으로 잡는다.
 */
@Mapper
public interface TierChangeMapper {

    String FROM_WHERE = """
            FROM audit_logs a
            JOIN song_difficulties d
              ON d.song_difficulty_id = JSON_VALUE(a.detail, '$.songDifficultyId' RETURNING UNSIGNED)
            JOIN songs s ON s.song_id = d.song_id
            WHERE d.is_deleted = FALSE
              AND s.is_deleted = FALSE
              AND (a.action = 'TABLE_ENTRY_CREATE'
                   OR (a.action = 'TABLE_ENTRY_UPDATE'
                       AND (NOT (JSON_VALUE(a.detail, '$.before.tier') <=> JSON_VALUE(a.detail, '$.after.tier'))
                            OR NOT (JSON_VALUE(a.detail, '$.before.pattern') <=> JSON_VALUE(a.detail, '$.after.pattern'))
                            OR NOT (JSON_VALUE(a.detail, '$.before.recommend') <=> JSON_VALUE(a.detail, '$.after.recommend')))))
            """;

    /** 최신순(같은 시각이면 로그 번호가 큰 것 먼저). limit/offset은 서비스가 상한을 검증해서 넘긴다. */
    @Select("""
            SELECT a.action                                     AS action,
                   a.created_at                                 AS changedAt,
                   s.song_id                                    AS songId,
                   s.title                                      AS title,
                   d.song_difficulty_id                         AS songDifficultyId,
                   d.instrument_part                            AS part,
                   d.difficulty_type                            AS difficulty,
                   d.level                                      AS level,
                   JSON_VALUE(a.detail, '$.before.tier')        AS beforeTier,
                   JSON_VALUE(a.detail, '$.after.tier')         AS afterTier,
                   JSON_VALUE(a.detail, '$.before.pattern')     AS beforePattern,
                   JSON_VALUE(a.detail, '$.after.pattern')      AS afterPattern,
                   JSON_VALUE(a.detail, '$.before.recommend')   AS beforeRecommend,
                   JSON_VALUE(a.detail, '$.after.recommend')    AS afterRecommend
            """ + FROM_WHERE + """
            ORDER BY a.created_at DESC, a.audit_log_id DESC
            LIMIT #{limit} OFFSET #{offset}
            """)
    List<TierChangeRow> findAll(@Param("limit") int limit, @Param("offset") long offset);

    @Select("SELECT COUNT(*) " + FROM_WHERE)
    long countAll();
}
