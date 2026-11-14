package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 대시보드(D80) 읽기 전용 쿼리 (MyBatis). 쓰기는 하지 않는다. 값은 #{} 바인딩만 쓴다(${} 금지).
 *
 * 개인정보 설계: 이 mapper는 개수(COUNT)와 날짜별 개수만 돌려준다. 이메일·닉네임·기록 내용을 select 하는 쿼리가 없다.
 * 사람이 드러날 수 있는 값은 findTierUserIds의 유저 id 목록뿐인데, 이것은 서비스 안에서 티어 계산(SkillService.ratedBatch)에만 쓰고
 * 응답으로 내보내지 않는다. 그 쿼리도 공개(profile_public) + ACTIVE 유저만 돌려주므로 비공개 유저의 id조차 읽지 않는다.
 *
 * 날짜 묶기(한국 시간): 시각은 UTC로 저장돼 있어서, 안쪽 쿼리에서 offsetSeconds(Asia/Seoul의 UTC 오프셋 = 32400초)를 더해
 * 날짜(day)를 만든 다음 그 열로 묶는다. 같은 식을 SELECT와 GROUP BY에 따로 쓰면 MySQL이 둘을 같은 식으로 보지 못해(ONLY_FULL_GROUP_BY)
 * 오류가 나므로, 안쪽 쿼리에서 한 번만 계산한다. 오프셋은 서비스가 계산해서 바인딩한다(DB의 시간대 표에 기대지 않는다).
 */
@Mapper
public interface DashboardMapper {

    /** 전체 가입자 수(차단 포함). */
    @Select("SELECT COUNT(*) FROM users")
    long countUsers();

    /** 공개 프로필 수: 공개 + ACTIVE + 닉네임 있음(서열표 분석 D77·유저 목록 D26과 같은 기준). */
    @Select("""
            SELECT COUNT(*)
            FROM users u
            WHERE u.profile_public = TRUE
              AND u.status = 'ACTIVE'
              AND u.nickname IS NOT NULL
            """)
    long countPublicProfiles();

    /** [since, until) 안에 가입한 수를 한국 시간 날짜별로. 가입이 없는 날은 나오지 않는다(서비스가 0으로 채운다). */
    @Select("""
            SELECT d.day AS day, COUNT(*) AS count
            FROM (
                SELECT DATE(DATE_ADD(u.created_at, INTERVAL #{offsetSeconds} SECOND)) AS day
                FROM users u
                WHERE u.created_at >= #{since}
                  AND u.created_at < #{until}
            ) d
            GROUP BY d.day
            ORDER BY d.day
            """)
    List<DayCountRow> countSignupsByDay(@Param("since") LocalDateTime since, @Param("until") LocalDateTime until,
                                        @Param("offsetSeconds") int offsetSeconds);

    /** [since, until) 안에 저장된 기록 건수를 한국 시간 날짜별로(created_at = 서버가 저장한 시각). */
    @Select("""
            SELECT d.day AS day, COUNT(*) AS count
            FROM (
                SELECT DATE(DATE_ADD(r.created_at, INTERVAL #{offsetSeconds} SECOND)) AS day
                FROM option_records r
                WHERE r.created_at >= #{since}
                  AND r.created_at < #{until}
            ) d
            GROUP BY d.day
            ORDER BY d.day
            """)
    List<DayCountRow> countRecordsByDay(@Param("since") LocalDateTime since, @Param("until") LocalDateTime until,
                                        @Param("offsetSeconds") int offsetSeconds);

    /** 건의 상태별 개수(없는 상태는 나오지 않는다). */
    @Select("""
            SELECT s.status AS status, COUNT(*) AS count
            FROM suggestions s
            GROUP BY s.status
            """)
    List<StatusCountRow> countSuggestionsByStatus();

    /** 레이팅 옵션(SRN+) 기록이 있는 전체 유저 수(비공개 포함, 개수만). */
    @Select("""
            SELECT COUNT(DISTINCT r.user_id)
            FROM option_records r
            WHERE r.note_option = #{noteOption}
            """)
    long countRecordedUsers(@Param("noteOption") String noteOption);

    /**
     * 티어 분포에 넣을 유저 id: SRN+ 기록이 있는 공개(profile_public) + ACTIVE + 닉네임 있는 유저만.
     * 비공개 유저의 id는 읽지 않는다(그 유저의 기록을 읽지 않는다는 D77의 원칙을 그대로 지킨다). 서비스가 이 id로 티어만 계산하고 id는 내보내지 않는다.
     */
    @Select("""
            SELECT DISTINCT u.user_id
            FROM users u
            JOIN option_records r ON r.user_id = u.user_id
            WHERE u.profile_public = TRUE
              AND u.status = 'ACTIVE'
              AND u.nickname IS NOT NULL
              AND r.note_option = #{noteOption}
            """)
    List<Long> findTierUserIds(@Param("noteOption") String noteOption);
}
