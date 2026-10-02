package com.srpfreaks.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.SongDifficulty;

public interface SongDifficultyRepository extends JpaRepository<SongDifficulty, Long>{

	public List<SongDifficulty> findBySongId(Long songId);
	
	public Optional<SongDifficulty> findBySongIdAndInstrumentPartAndDifficultyType(
			Long songId, InstrumentPart instrumentPart, DifficultyType difficultyType
	);
}
