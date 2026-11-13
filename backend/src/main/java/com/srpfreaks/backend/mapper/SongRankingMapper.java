package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 곡별 순위(D74) 읽기 전용 쿼리 (MyBatis). 쓰기는 하지 않는다. 값은 #{} 바인딩만 쓴다(${} 금지).
 * 정렬도 SQL에 고정해서 요청으로 받지 않는다(그래서 정렬 화이트리스트가 필요 없다).
 *
 * 왜 MyBatis인가: "유저마다 이 채보의 최고 달성률 한 줄 + 그 달성률을 처음 저장한 시각"은 집계라서 JPQL보다 SQL이 읽기 쉽다.
 * 순위 번호와 달성 단계는 서비스(Java)가 계산한다.
 *
 * 개인정보 설계의 핵심: 순위의 모든 쿼리(목록·인원·내 줄·내 앞 사람 수)는 아래 BEST_PER_PUBLIC_USER 한 조각에서 출발한다.
 * 그래서 "공개(profile_public) + ACTIVE + 닉네임 있음" 조건이 목록과 count와 내 순위 계산에 똑같이 걸린다(D63과 같은 원칙).
 * 비공개·차단·탈퇴 유저는 이 조각 안에 아예 없으므로, 순위 번호가 건너뛰거나 인원 수에 섞이는 일이 없다.
 *
 * 인덱스: users(수십~수백 명의 공개 유저)에서 시작해 유저마다 ix_option_records_best (user_id, song_difficulty_id, note_option, ...)를
 * (user_id, 채보, 옵션)으로 한 번씩 찾아가는 모양이다. 이 채보를 기준으로 유저를 훑는 인덱스는 없고 지금 규모에서는 필요하지 않다(DESIGN.md 18.2.2).
 */
@Mapper
public interface SongRankingMapper {

    /**
     * 공개 유저마다 이 채보의 SRN+ 기록 중 최고 달성률 1줄. (유저, 채보, 옵션)에 기록이 있는 공개 유저만 나온다.
     * - u.profile_public = TRUE AND u.status = 'ACTIVE': 공개를 선택한 활성 유저만(D26, D46). 탈퇴한 유저는 기록이 CASCADE로 지워져 자동으로 없다(D20).
     * - u.nickname IS NOT NULL: 공개는 닉네임이 있어야 켤 수 있지만(D26), 데이터가 어긋나도 이름 없는 줄은 내보내지 않는다.
     * - full_combo: 하나라도 FC면 1. 레이팅 쪽(SkillMapper)과 같은 방식이라 화면의 단계(EXC/FC/SS..)가 다른 화면과 같다.
     * - '<' 문자를 쓰지 않는다(다른 조각과 합칠 때 방향을 뒤집어 쓴다).
     */
    String BEST_PER_PUBLIC_USER = """
            SELECT u.user_id AS user_id,
                   u.nickname AS nickname,
                   MAX(r.achievement_rate) AS best_rate,
                   MAX(r.is_full_combo) AS full_combo
            FROM users u
            JOIN option_records r ON r.user_id = u.user_id
            WHERE u.profile_public = TRUE
              AND u.status = 'ACTIVE'
              AND u.nickname IS NOT NULL
              AND r.song_difficulty_id = #{songDifficultyId}
              AND r.note_option = #{noteOption}
            GROUP BY u.user_id, u.nickname
            """;

    /**
     * 순위 한 줄 = 위 조각 + 동점 처리용 시각(achievedAt).
     * achievedAt = 그 유저가 최고 달성률과 같은 달성률로 남긴 기록들 중 가장 이른 created_at.
     * 같은 최고 달성률 기록이 여러 줄이면 "먼저 저장한 쪽"이 인정된다. 한계(감수하기로 결정, D74 (가)): created_at은 기록을 고쳐도 바뀌지 않아서,
     * 예전 기록을 수정해 달성률을 올리면 "그 행을 처음 만든 시각"이 쓰인다. 영향은 동점 순서뿐이다.
     */
    String RANKED = """
            SELECT b.user_id AS userId,
                   b.nickname AS nickname,
                   b.best_rate AS bestRate,
                   b.full_combo AS fullCombo,
                   (SELECT MIN(r2.created_at)
                      FROM option_records r2
                     WHERE r2.user_id = b.user_id
                       AND r2.song_difficulty_id = #{songDifficultyId}
                       AND r2.note_option = #{noteOption}
                       AND r2.achievement_rate = b.best_rate) AS achievedAt
            FROM (""" + BEST_PER_PUBLIC_USER + """
            ) b
            """;

    /**
     * 한 페이지. 정렬: 최고 달성률 내림차순 -> 그 달성률을 먼저 저장한 쪽 -> user_id 오름차순.
     * 마지막 user_id까지 걸어서 순서가 요청마다 바뀌지 않고, 순위 번호가 겹치지 않는다(1, 2, 3...). 순위 번호는 서비스가 offset + 줄 번호로 붙인다.
     */
    @Select("SELECT t.userId, t.nickname, t.bestRate, t.fullCombo, t.achievedAt FROM (" + RANKED + """
            ) t
            ORDER BY t.bestRate DESC, t.achievedAt ASC, t.userId ASC
            LIMIT #{limit} OFFSET #{offset}
            """)
    List<RankingRow> findPage(@Param("songDifficultyId") Long songDifficultyId,
                              @Param("noteOption") String noteOption,
                              @Param("limit") int limit,
                              @Param("offset") long offset);

    /** 이 채보에 기록이 있는 공개 유저 수("기록한 공개 유저 M명"의 M). 목록과 같은 조각에서 센다. 비공개 유저는 세지 않는다. */
    @Select("SELECT COUNT(*) FROM (" + BEST_PER_PUBLIC_USER + ") b")
    long countPlayers(@Param("songDifficultyId") Long songDifficultyId,
                      @Param("noteOption") String noteOption);

    /**
     * 내 줄. 내가 공개 유저이고 이 채보에 SRN+ 기록이 있을 때만 나온다(아니면 null).
     * 비공개인 나는 조각 안에 없으므로 여기서도 null이다 -> 비공개 유저의 달성률이 어떤 응답으로도 나가지 않는다.
     */
    @Select("SELECT t.userId, t.nickname, t.bestRate, t.fullCombo, t.achievedAt FROM (" + RANKED + """
            ) t
            WHERE t.userId = #{userId}
            """)
    RankingRow findMine(@Param("songDifficultyId") Long songDifficultyId,
                        @Param("noteOption") String noteOption,
                        @Param("userId") Long userId);

    /**
     * 내 앞에 있는 공개 유저 수 -> 내 순위 = 이 값 + 1. 정렬(findPage)과 같은 기준을 조건으로 옮긴 것이다:
     * 나보다 달성률이 높거나, 같으면 먼저 저장했거나, 그것도 같으면 user_id가 작은 사람.
     * 목록과 같은 조각에서 세므로 비공개 유저는 앞사람 수에도 들어가지 않는다.
     */
    @Select("SELECT COUNT(*) FROM (" + RANKED + """
            ) t
            WHERE t.bestRate > #{bestRate}
               OR (t.bestRate = #{bestRate}
                   AND (#{achievedAt} > t.achievedAt
                        OR (t.achievedAt = #{achievedAt} AND #{userId} > t.userId)))
            """)
    long countAhead(@Param("songDifficultyId") Long songDifficultyId,
                    @Param("noteOption") String noteOption,
                    @Param("bestRate") BigDecimal bestRate,
                    @Param("achievedAt") LocalDateTime achievedAt,
                    @Param("userId") Long userId);
}
