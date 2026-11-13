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
}
