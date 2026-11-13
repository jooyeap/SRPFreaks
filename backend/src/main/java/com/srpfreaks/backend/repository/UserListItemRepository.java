package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.UserListItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 내 리스트 항목 조회/저장 (D76). 소유자 확인은 서비스가 리스트(UserListRepository.findByIdAndUserId)로 먼저 한다.
 * 삭제된(소프트 삭제) 곡·채보는 목록과 개수에서 뺀다.
 */
public interface UserListItemRepository extends JpaRepository<UserListItem, Long> {

    /** 순서대로. 채보와 곡을 fetch join으로 한 번에 읽는다(ManyToOne뿐이라 페이지 처리와 함께 써도 안전). */
    @Query(value = """
            select i from UserListItem i
            join fetch i.songDifficulty d
            join fetch d.song s
            where i.userList.id = :listId and d.deleted = false and s.deleted = false
            order by i.sortOrder asc, i.id asc
            """,
            countQuery = """
            select count(i) from UserListItem i
            where i.userList.id = :listId and i.songDifficulty.deleted = false and i.songDifficulty.song.deleted = false
            """)
    Page<UserListItem> findVisibleByListId(@Param("listId") Long listId, Pageable pageable);

    @Query("""
            select count(i) from UserListItem i
            where i.userList.id = :listId and i.songDifficulty.deleted = false and i.songDifficulty.song.deleted = false
            """)
    long countVisibleByListId(@Param("listId") Long listId);

    Optional<UserListItem> findByUserListIdAndSongDifficultyId(Long listId, Long songDifficultyId);

    /** 순서를 바꿀 때 쓰는 리스트 전체 줄(상한이 작아 한 번에 읽는다). 삭제된 채보의 줄도 포함한다. */
    @Query("""
            select i from UserListItem i
            join fetch i.songDifficulty d
            where i.userList.id = :listId
            order by i.sortOrder asc, i.id asc
            """)
    List<UserListItem> findAllByListId(@Param("listId") Long listId);

    /** 새 곡을 맨 뒤에 두려고 쓰는 가장 큰 순서값(비어 있으면 null). */
    @Query("select max(i.sortOrder) from UserListItem i where i.userList.id = :listId")
    Integer findMaxSortOrder(@Param("listId") Long listId);

    /** 여러 리스트의 곡 수를 한 번에(N+1 방지). 곡이 없는 리스트는 결과에 없다. */
    @Query("""
            select new com.srpfreaks.backend.repository.ListItemCount(i.userList.id, count(i))
            from UserListItem i
            where i.userList.id in :listIds and i.songDifficulty.deleted = false and i.songDifficulty.song.deleted = false
            group by i.userList.id
            """)
    List<ListItemCount> countVisibleByListIds(@Param("listIds") Collection<Long> listIds);

    /** 이 채보가 담겨 있는 내 리스트들의 id(곡 상세의 담기 시트용). */
    @Query("""
            select i.userList.id from UserListItem i
            where i.userList.user.id = :userId and i.songDifficulty.id = :songDifficultyId
            """)
    List<Long> findListIdsContaining(@Param("userId") Long userId, @Param("songDifficultyId") Long songDifficultyId);
}
