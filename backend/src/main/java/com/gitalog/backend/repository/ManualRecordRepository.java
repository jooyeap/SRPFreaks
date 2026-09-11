package com.gitalog.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.gitalog.backend.entity.ManualRecord;
import com.gitalog.backend.entity.OptionType;

public interface ManualRecordRepository extends JpaRepository<ManualRecord, Long>{

	public List<ManualRecord> findByUserId(Long userId);
	
	public List<ManualRecord> findByUser_IdAndDifficulty_Song_Id(Long userId, Long songId);
	
	public List<ManualRecord> findByUserIdAndDifficultyIdAndOptionTypeOrderByAchievementRateDesc(
		Long userId, Long difficultyId, OptionType optionType
	);
	
	public List<ManualRecord> findByOptionTypeOrderByAchievementRateDesc(OptionType optionType);
}
