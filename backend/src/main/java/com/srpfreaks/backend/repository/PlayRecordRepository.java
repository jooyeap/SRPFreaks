package com.srpfreaks.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.srpfreaks.backend.entity.PlayRecord;

public interface PlayRecordRepository extends JpaRepository<PlayRecord, Long>{

	public List<PlayRecord> findByUserId(Long userId);
	
	public Optional<PlayRecord> findByUserIdAndDifficultyId(Long userId, Long difficultyId);
	
	public List<PlayRecord> findByUser_IdAndDifficultyId(Long userId, Long difficultyId);
	
	public List<PlayRecord> findByUser_IdAndDifficulty_Song_Id(Long userId, Long songId);
}
