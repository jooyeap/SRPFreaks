package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.SetlistItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * 세트리스트 조회/저장. 모든 조회에 user_id 조건이 걸려 남의 줄은 섞이지 않는다.
 * 삭제된(소프트 삭제) 곡·채보는 목록과 개수에서 뺀다.
 */
public interface SetlistItemRepository extends JpaRepository<SetlistItem, Long> {

    /** 담은 순서(오래된 것이 위). 채보와 곡을 fetch join으로 한 번에 읽는다(ManyToOne뿐이라 페이지 처리와 함께 써도 안전). */
    @Query(value = """
            select i from SetlistItem i
            join fetch i.songDifficulty d
            join fetch d.song s
            where i.user.id = :userId and d.deleted = false and s.deleted = false
            order by i.createdAt asc, i.id asc
            """,
            countQuery = """
            select count(i) from SetlistItem i
            where i.user.id = :userId and i.songDifficulty.deleted = false and i.songDifficulty.song.deleted = false
            """)
    Page<SetlistItem> findActiveByUserId(@Param("userId") Long userId, Pageable pageable);

    /** 완료한 줄을 비울 때 쓰는 전체 목록(최대 30줄 + 삭제된 채보의 남은 줄). */
    @Query("""
            select i from SetlistItem i
            join fetch i.songDifficulty d
            where i.user.id = :userId
            """)
    List<SetlistItem> findAllByUserId(@Param("userId") Long userId);

    @Query("""
            select count(i) from SetlistItem i
            where i.user.id = :userId and i.songDifficulty.deleted = false and i.songDifficulty.song.deleted = false
            """)
    long countActiveByUserId(@Param("userId") Long userId);

    boolean existsByUserIdAndSongDifficultyId(Long userId, Long songDifficultyId);

    Optional<SetlistItem> findByIdAndUserId(Long id, Long userId);
}
