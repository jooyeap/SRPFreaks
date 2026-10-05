package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyTableEntry;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** 난이도표 항목 조회/저장. 집계(서열표 묶음, 레이팅 목록)는 이후 MyBatis로 한다. */
public interface DifficultyTableEntryRepository extends JpaRepository<DifficultyTableEntry, Long> {

    /** (표, 채보)는 유일하다. 서열표 CSV 업서트용. */
    Optional<DifficultyTableEntry> findByDifficultyTableIdAndSongDifficultyId(Long difficultyTableId, Long songDifficultyId);

    Page<DifficultyTableEntry> findByDifficultyTableId(Long difficultyTableId, Pageable pageable);

    /** 서열표 CSV 가져오기/내려받기: 표의 항목 전체. 표 하나가 수백~수천 줄이라 한 번에 읽는다. */
    List<DifficultyTableEntry> findAllByDifficultyTableId(Long difficultyTableId);
}
