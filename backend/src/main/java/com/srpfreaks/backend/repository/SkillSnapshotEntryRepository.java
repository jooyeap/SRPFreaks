package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.SkillSnapshotEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** 스냅샷 상세 조회/저장. 읽을 때는 곡 제목까지 한 번에 가져온다(채보·곡 fetch join으로 N+1 방지). */
public interface SkillSnapshotEntryRepository extends JpaRepository<SkillSnapshotEntry, Long> {

    @Query("""
            select e from SkillSnapshotEntry e
              join fetch e.songDifficulty d
              join fetch d.song
             where e.snapshot.id = :snapshotId
             order by e.listGroup, e.listRank
            """)
    List<SkillSnapshotEntry> findAllWithChart(@Param("snapshotId") Long snapshotId);

    boolean existsBySnapshot_Id(Long snapshotId);
}
