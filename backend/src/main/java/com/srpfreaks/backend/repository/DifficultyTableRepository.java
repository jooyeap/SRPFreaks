package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyTable;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 난이도표 조회/저장. */
public interface DifficultyTableRepository extends JpaRepository<DifficultyTable, Long> {

    Optional<DifficultyTable> findByName(String name);
}
