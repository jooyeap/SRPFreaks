package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.SongDifficulty;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 채보 조회/저장. */
public interface SongDifficultyRepository extends JpaRepository<SongDifficulty, Long> {

    Optional<SongDifficulty> findByIdAndDeletedFalse(Long id);

    List<SongDifficulty> findBySongIdAndDeletedFalse(Long songId);

    /** (곡, 파트, 난이도 종류)는 유일하다. CSV 업서트와 기록 연결에 쓴다. */
    Optional<SongDifficulty> findBySongIdAndInstrumentPartAndDifficultyType(
            Long songId, InstrumentPart instrumentPart, DifficultyType difficultyType);

    /** CSV 일괄 등록: 곡들의 채보를 한 번에 읽는다(삭제된 채보 포함. 행마다 조회하면 쿼리가 수백 번 나간다). */
    List<SongDifficulty> findBySongIdIn(Collection<Long> songIds);
}
