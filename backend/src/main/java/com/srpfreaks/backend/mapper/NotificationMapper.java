package com.srpfreaks.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 알림 목록(라이벌 D56 + 서열표 변경 D61)을 한 목록으로 합치는 읽기 전용 쿼리. #{}만 쓴다.
 *
 * 두 알림은 테이블이 달라서 JPA 페이징으로는 "둘을 섞은 n번째 쪽"을 만들 수 없다.
 * 그래서 여기서는 UNION ALL로 (종류, id, 시각)만 시간순으로 한 쪽만큼 뽑고, 내용은 서비스가 각 저장소(JPA)에서 id로 읽는다.
 * - 라이벌: 보이는(SHOWN) 줄만, 시각 = visible_at(보인 시각)
 * - 서열표: 모든 줄, 시각 = changed_at(서열표가 바뀐 시각)
 * 같은 시각이면 종류 → id 큰 것 순으로 고정해 쪽이 넘어갈 때 줄이 겹치거나 빠지지 않게 한다.
 */
@Mapper
public interface NotificationMapper {

    @Select("""
            SELECT kind, id FROM (
                SELECT 'RIVAL' AS kind, n.rival_notification_id AS id, n.visible_at AS at
                FROM rival_notifications n
                WHERE n.recipient_user_id = #{userId} AND n.status = 'SHOWN'
                UNION ALL
                SELECT 'TIER' AS kind, t.tier_notification_id AS id, t.changed_at AS at
                FROM tier_notifications t
                WHERE t.user_id = #{userId}
            ) x
            ORDER BY at DESC, kind DESC, id DESC
            LIMIT #{limit} OFFSET #{offset}
            """)
    List<NotificationKey> findPage(@Param("userId") Long userId, @Param("limit") int limit, @Param("offset") long offset);

    @Select("""
            SELECT (SELECT COUNT(*) FROM rival_notifications n WHERE n.recipient_user_id = #{userId} AND n.status = 'SHOWN')
                 + (SELECT COUNT(*) FROM tier_notifications t WHERE t.user_id = #{userId})
            """)
    long countAll(@Param("userId") Long userId);

    // ---- 라이벌 묶음 알림의 곡 목록(D86) ----
    // 묶음 줄에 속한 곡 = 같은 (받는 사람, 역전한 사람, 보인 날)의 묶음 줄 자신 + BUNDLED 줄들. 삭제된 곡·채보는 뺀다.
    // 묶음 줄 자신이 맨 앞(첫 곡), 나머지는 합쳐진 순서. 달성률은 줄에 저장된 값이다(지금 최고 기록이 아님).

    @Select("""
            SELECT d.song_difficulty_id AS songDifficultyId, s.title AS title, d.instrument_part AS part,
                   d.difficulty_type AS difficulty, r.actor_rate AS actorRate, r.recipient_rate AS myRate
            FROM rival_notifications r
            JOIN song_difficulties d ON d.song_difficulty_id = r.song_difficulty_id
            JOIN songs s ON s.song_id = d.song_id
            WHERE r.recipient_user_id = #{userId} AND r.actor_user_id = #{actorId} AND r.alert_date = #{alertDate}
              AND (r.rival_notification_id = #{bundleId} OR r.status = 'BUNDLED')
              AND d.is_deleted = FALSE AND s.is_deleted = FALSE
            ORDER BY (r.rival_notification_id = #{bundleId}) DESC, r.rival_notification_id ASC
            LIMIT #{limit} OFFSET #{offset}
            """)
    List<RivalBundleSongRow> findBundleSongs(@Param("userId") Long userId, @Param("actorId") Long actorId,
                                             @Param("alertDate") java.time.LocalDate alertDate,
                                             @Param("bundleId") Long bundleId,
                                             @Param("limit") int limit, @Param("offset") long offset);

    @Select("""
            SELECT COUNT(*)
            FROM rival_notifications r
            JOIN song_difficulties d ON d.song_difficulty_id = r.song_difficulty_id
            JOIN songs s ON s.song_id = d.song_id
            WHERE r.recipient_user_id = #{userId} AND r.actor_user_id = #{actorId} AND r.alert_date = #{alertDate}
              AND (r.rival_notification_id = #{bundleId} OR r.status = 'BUNDLED')
              AND d.is_deleted = FALSE AND s.is_deleted = FALSE
            """)
    long countBundleSongs(@Param("userId") Long userId, @Param("actorId") Long actorId,
                          @Param("alertDate") java.time.LocalDate alertDate, @Param("bundleId") Long bundleId);

    /**
     * 목록 한 쪽에 든 묶음 줄들의 곡명 미리보기(합쳐진 처음 2곡. 묶음 줄 자신의 곡 1개와 합쳐 최대 3개). 쿼리 한 번, 삭제된 곡 제외.
     * 윈도 함수(ROW_NUMBER)로 묶음 줄마다 앞 2개만 남긴다.
     */
    @Select("""
            <script>
            SELECT bundle_id AS bundleId, title, rn FROM (
                SELECT b.rival_notification_id AS bundle_id, s.title AS title,
                       ROW_NUMBER() OVER (PARTITION BY b.rival_notification_id ORDER BY m.rival_notification_id) AS rn
                FROM rival_notifications b
                JOIN rival_notifications m ON m.recipient_user_id = b.recipient_user_id AND m.actor_user_id = b.actor_user_id
                     AND m.alert_date = b.alert_date AND m.status = 'BUNDLED'
                JOIN song_difficulties d ON d.song_difficulty_id = m.song_difficulty_id AND d.is_deleted = FALSE
                JOIN songs s ON s.song_id = d.song_id AND s.is_deleted = FALSE
                WHERE b.recipient_user_id = #{userId} AND b.rival_notification_id IN
                <foreach collection="bundleIds" item="id" open="(" separator="," close=")">#{id}</foreach>
            ) x WHERE rn &lt;= 2
            ORDER BY bundle_id, rn
            </script>
            """)
    List<RivalBundleSummaryRow> findBundlePreviews(@Param("userId") Long userId, @Param("bundleIds") List<Long> bundleIds);

    /** 묶음 줄마다 남아 있는(BUNDLED) 줄 수. 삭제된 곡도 센다(예전 묶음과 구분하려고). */
    @Select("""
            <script>
            SELECT b.rival_notification_id AS bundleId, COUNT(m.rival_notification_id) AS memberCount
            FROM rival_notifications b
            LEFT JOIN rival_notifications m ON m.recipient_user_id = b.recipient_user_id AND m.actor_user_id = b.actor_user_id
                 AND m.alert_date = b.alert_date AND m.status = 'BUNDLED'
            WHERE b.recipient_user_id = #{userId} AND b.rival_notification_id IN
            <foreach collection="bundleIds" item="id" open="(" separator="," close=")">#{id}</foreach>
            GROUP BY b.rival_notification_id
            </script>
            """)
    List<RivalBundleCountRow> findBundleMemberCounts(@Param("userId") Long userId, @Param("bundleIds") List<Long> bundleIds);
}
