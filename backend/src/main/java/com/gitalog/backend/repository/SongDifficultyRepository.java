package com.gitalog.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.gitalog.backend.entity.DifficultyType;
import com.gitalog.backend.entity.InstrumentPart;
import com.gitalog.backend.entity.SongDifficulty;

public interface SongDifficultyRepository extends JpaRepository<SongDifficulty, Long>{

	public List<SongDifficulty> findBySongId(Long songId);
	
	public Optional<SongDifficulty> findBySongIdAndInstrumentPartAndDifficultyType(
			Long songId, InstrumentPart instrumentPart, DifficultyType difficultyType
	);
}
