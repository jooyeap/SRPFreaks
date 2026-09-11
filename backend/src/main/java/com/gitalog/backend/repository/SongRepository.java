package com.gitalog.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.gitalog.backend.entity.Song;

public interface SongRepository extends JpaRepository<Song, Long>{
	
	public List<Song> findByTitleContaining(String keyword);
	
	@Query("SELECT s FROM Song s WHERE s.title LIKE %:keyword% OR s.artist LIKE %:keyword%")
	public List<Song> searchByKeyword(@Param("keyword") String keyword);
}
