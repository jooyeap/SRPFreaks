package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 곡 정보 정리(D91, ROOT·ADMIN 화면) 읽기 전용 쿼리 (MyBatis). 쓰기는 하지 않는다. 값은 #{}만 쓴다(${} 금지).
 *
 * 왜 MyBatis인가: "아티스트가 비었거나 song_titles 행이 없는 곡"을 곡마다 최고 레벨 채보와 함께 한 번에 거르는 조회라
 * JPQL보다 SQL이 읽기 쉽다. 저장은 기존 곡 수정 API(D22)가 하고 이 쿼리는 목록만 만든다.
 *
 * 조건 정의:
 *  - 아티스트 없음 = artist가 NULL이거나 공백뿐
 *  - 검색 키워드 없음 = 그 곡의 song_titles 행이 하나도 없음
 *  - 삭제된 곡(is_deleted)은 어느 쪽에도 들어가지 않는다.
 * 정렬은 ORDER BY에 #{}를 쓸 수 없어서 CASE로 고른다. sort 값은 서비스의 화이트리스트(title / level)를 통과한 것만 온다.
 * filter 값(ANY / ARTIST / KEYWORD / BOTH)도 서비스가 검증하며, SQL 글자로 이어 붙이지 않고 비교 값으로만 바인딩한다.
 * pattern은 서비스가 LIKE용으로 이스케이프한 값이다(이스케이프 문자 '!').
 */
@Mapper
public interface SongMetaTodoMapper {

    /**
     * 곡마다 레벨이 가장 높은 채보 한 줄(rn = 1)을 붙인다. 곡당 정확히 한 줄이라 행이 늘지 않고 COUNT도 같다.
     * 필터는 filter 값으로 고른다(글자를 이어 붙이지 않고 비교 값으로만 바인딩한다).
     */
    String FROM_WHERE = """
            FROM songs s
            LEFT JOIN (
                SELECT d.song_id, d.instrument_part, d.difficulty_type, d.level,
                       ROW_NUMBER() OVER (PARTITION BY d.song_id ORDER BY d.level DESC, d.song_difficulty_id DESC) AS rn
                FROM song_difficulties d
                WHERE d.is_deleted = FALSE
            ) tc ON tc.song_id = s.song_id AND tc.rn = 1
            WHERE s.is_deleted = FALSE
              AND ((#{filter} = 'ANY' AND ((s.artist IS NULL OR TRIM(s.artist) = '')
                                           OR NOT EXISTS (SELECT 1 FROM song_titles t WHERE t.song_id = s.song_id)))
                OR (#{filter} = 'ARTIST' AND (s.artist IS NULL OR TRIM(s.artist) = ''))
                OR (#{filter} = 'KEYWORD' AND NOT EXISTS (SELECT 1 FROM song_titles t WHERE t.song_id = s.song_id))
                OR (#{filter} = 'BOTH' AND (s.artist IS NULL OR TRIM(s.artist) = '')
                                       AND NOT EXISTS (SELECT 1 FROM song_titles t WHERE t.song_id = s.song_id)))
              AND (#{pattern} IS NULL OR s.title LIKE #{pattern} ESCAPE '!')
            """;

    /** 목록. limit/offset은 서비스가 상한을 검증해서 넘긴다. 같은 정렬 값이면 곡 번호로 순서를 고정한다(페이지가 겹치지 않게). */
    @Select("""
            SELECT s.song_id AS songId,
                   s.title AS title,
                   s.artist AS artist,
                   (SELECT COUNT(*) FROM song_titles c WHERE c.song_id = s.song_id) AS titleCount,
                   tc.instrument_part AS topPart,
                   tc.difficulty_type AS topDifficulty,
                   tc.level AS topLevel
            """ + FROM_WHERE + """
            ORDER BY CASE WHEN #{sort} = 'level' THEN tc.level END DESC, s.title ASC, s.song_id ASC
            LIMIT #{limit} OFFSET #{offset}
            """)
    List<SongMetaTodoRow> findPage(@Param("filter") String filter, @Param("pattern") String pattern,
                                   @Param("sort") String sort, @Param("limit") int limit, @Param("offset") long offset);

    @Select("SELECT COUNT(*) " + FROM_WHERE)
    long count(@Param("filter") String filter, @Param("pattern") String pattern);

    /** 요약 건수(검색어·필터와 무관한 전체 기준). 삭제되지 않은 곡만 센다. */
    @Select("""
            SELECT COUNT(*) AS totalSongs,
                   COALESCE(SUM(s.artist IS NULL OR TRIM(s.artist) = ''), 0) AS noArtist,
                   COALESCE(SUM(NOT EXISTS (SELECT 1 FROM song_titles t WHERE t.song_id = s.song_id)), 0) AS noKeyword,
                   COALESCE(SUM((s.artist IS NULL OR TRIM(s.artist) = '')
                                AND NOT EXISTS (SELECT 1 FROM song_titles t WHERE t.song_id = s.song_id)), 0) AS bothMissing
            FROM songs s
            WHERE s.is_deleted = FALSE
            """)
    SongMetaTodoSummaryRow summary();
}
