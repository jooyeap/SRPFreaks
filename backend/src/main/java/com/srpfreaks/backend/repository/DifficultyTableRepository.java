package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.TableStatus;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 난이도표 조회/저장. */
public interface DifficultyTableRepository extends JpaRepository<DifficultyTable, Long> {

    Optional<DifficultyTable> findByName(String name);

    /**
     * 레이팅이 쓰는 서열표: 기준 옵션이 같은 ACTIVE 표 중 id가 가장 작은 것 (docs/DESIGN.md 7장).
     * 표를 여러 개 만들어도 레이팅이 흔들리지 않게 "가장 먼저 만든 표"로 고정한다.
     */
    Optional<DifficultyTable> findFirstByNoteOptionAndStatusOrderByIdAsc(NoteOption noteOption, TableStatus status);
}
