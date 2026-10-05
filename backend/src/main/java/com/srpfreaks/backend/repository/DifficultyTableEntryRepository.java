package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyTableEntry;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** 난이도표 항목 조회/저장. 집계(서열표 묶음, 레이팅 목록)는 이후 MyBatis로 한다. */
public interface DifficultyTableEntryRepository extends JpaRepository<DifficultyTableEntry, Long> {

    /** (표, 채보)는 유일하다. 서열표 항목 중복 확인과 기록 연결에 쓴다. */
    Optional<DifficultyTableEntry> findByDifficultyTableIdAndSongDifficultyId(Long difficultyTableId, Long songDifficultyId);

    Page<DifficultyTableEntry> findByDifficultyTableId(Long difficultyTableId, Pageable pageable);

}
