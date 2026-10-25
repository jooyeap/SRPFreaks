package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 감사 로그 검색용 읽기 전용 쿼리 (MyBatis, ROOT 화면). 쓰기는 하지 않는다. 값은 #{} 바인딩만 쓴다(${} 금지).
 *
 * 왜 MyBatis인가: "작업 종류 + 로그 내용(JSON) + 두 사용자(작업한 사람, 대상 사용자)의 닉네임"을 한 번에 거르는 조회라서
 * JPQL로 JSON 컬럼을 글자로 바꿔 비교하기보다 SQL이 읽기 쉽다. 여기서는 로그 id만 뽑고, 로그와 작업한 사람은
 * JPA(@EntityGraph)가 한 번에 읽어 온다 -> 응답 만드는 규칙(AuditLogResponse)이 한 곳에만 있도록.
 *
 * 검색어(pattern)는 서비스가 LIKE용으로 이미 이스케이프한 값이다. 이스케이프 문자는 '!'를 쓴다(MySQL에서 '\'는 문자열 안에서
 * 다시 이스케이프되어 자바 문자열과 겹치기 쉽다). 검색 대상은 아래 네 가지다.
 *  (1) 작업한 사람의 현재 닉네임  (2) 대상 사용자의 현재 닉네임(target_type이 USER일 때, 역할 변경·차단 로그는 대상 이름을 detail에 남기지 않는다)
 *  (3) target_id  (4) detail(JSON)을 글자로 바꾼 것 -> 닉네임 변경 로그의 이전·새 닉네임도 여기서 찾는다.
 * 탈퇴한 사용자의 닉네임 변경 로그는 이미 지워지므로(D48) 검색에도 나오지 않는다.
 *
 * 필터 값이 null이면 그 조건은 걸지 않는다. action은 같은 글자 일치, 대소문자는 구분하지 않는 DB 비교다.
 */
@Mapper
public interface AuditLogSearchMapper {

    String FROM_WHERE = """
            FROM audit_logs a
            LEFT JOIN users au ON au.user_id = a.actor_id
            LEFT JOIN users tu ON a.target_type = 'USER' AND tu.user_id = CAST(a.target_id AS UNSIGNED)
            WHERE (#{action} IS NULL OR a.action = #{action})
              AND (#{pattern} IS NULL
                   OR au.nickname LIKE #{pattern} ESCAPE '!'
                   OR tu.nickname LIKE #{pattern} ESCAPE '!'
                   OR a.target_id LIKE #{pattern} ESCAPE '!'
                   OR CAST(a.detail AS CHAR) LIKE #{pattern} ESCAPE '!')
            """;

    /** 최신순(같은 시각이면 로그 번호가 큰 것 먼저, 목록 API와 같은 순서). limit/offset은 서비스가 상한을 검증해서 넘긴다. */
    @Select("SELECT a.audit_log_id " + FROM_WHERE + """
            ORDER BY a.created_at DESC, a.audit_log_id DESC
            LIMIT #{limit} OFFSET #{offset}
            """)
    List<Long> findIds(@Param("action") String action, @Param("pattern") String pattern,
                       @Param("limit") int limit, @Param("offset") long offset);

    @Select("SELECT COUNT(*) " + FROM_WHERE)
    long count(@Param("action") String action, @Param("pattern") String pattern);
}
