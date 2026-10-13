package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SkillSnapshot;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

/** 레이팅 스냅샷 조회/저장. 모든 조회는 user_id 조건을 포함한다(남의 스냅샷에 닿지 않게). */
public interface SkillSnapshotRepository extends JpaRepository<SkillSnapshot, Long> {

    /** 가장 최근 스냅샷 (변경 여부 비교용) */
    Optional<SkillSnapshot> findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(Long userId, NoteOption noteOption);

    boolean existsByUser_IdAndNoteOptionAndSnapshotDate(Long userId, NoteOption noteOption, LocalDate snapshotDate);

    /** 최근 순 목록 */
    Page<SkillSnapshot> findByUser_IdAndNoteOptionOrderBySnapshotDateDesc(Long userId, NoteOption noteOption, Pageable pageable);

    /** 주어진 날짜 바로 이전의 스냅샷 (목록 페이지의 마지막 줄 증감 계산용) */
    Optional<SkillSnapshot> findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(
            Long userId, NoteOption noteOption, LocalDate date);
}
