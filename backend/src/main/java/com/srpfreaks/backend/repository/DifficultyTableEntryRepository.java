package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyTableEntry;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 난이도표 항목 조회/저장. 집계(서열표 묶음, 레이팅 목록)는 이후 MyBatis로 한다. */
public interface DifficultyTableEntryRepository extends JpaRepository<DifficultyTableEntry, Long> {

    /** (표, 채보)는 유일하다. 서열표 항목 중복 확인과 기록 연결에 쓴다. */
    Optional<DifficultyTableEntry> findByDifficultyTableIdAndSongDifficultyId(Long difficultyTableId, Long songDifficultyId);

    Page<DifficultyTableEntry> findByDifficultyTableId(Long difficultyTableId, Pageable pageable);

    /**
     * 서열표 화면용: 항목 + 채보 + 곡을 fetch join 한 번으로 가져온다(LAZY 연관을 하나씩 열면 N+1).
     * 삭제된(소프트 삭제) 곡·채보는 뺀다.
     */
    @Query("""
            select e from DifficultyTableEntry e
            join fetch e.songDifficulty d
            join fetch d.song s
            where e.difficultyTable.id = :tableId and d.deleted = false and s.deleted = false
            """)
    List<DifficultyTableEntry> findAllForView(@Param("tableId") Long tableId);
}
