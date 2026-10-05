package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Song;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** 곡 조회/저장. 목록은 반드시 페이지네이션. */
public interface SongRepository extends JpaRepository<Song, Long> {

    /** 소프트 삭제된 곡은 제외한다. 곡 조회는 항상 이 메서드들로 한다. */
    Optional<Song> findByIdAndDeletedFalse(Long id);

    Page<Song> findByDeletedFalse(Pageable pageable);
}
