package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.SkillSnapshotEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    /**
     * 스냅샷의 상세를 전부 지운다(오늘 기록 갱신용). 벌크 삭제라 바로 실행된다.
     * 파생 삭제(deleteBy...)를 쓰면 Hibernate가 새 상세 INSERT를 DELETE보다 먼저 보낼 수 있어서
     * 같은 채보를 다시 넣을 때 유일 키(uk_skill_snapshot_entries_chart)에 걸린다(SongTitleRepository와 같은 이유).
     */
    @Modifying(flushAutomatically = true)
    @Query("delete from SkillSnapshotEntry e where e.snapshot.id = :snapshotId")
    void deleteAllBySnapshotId(@Param("snapshotId") Long snapshotId);
}
