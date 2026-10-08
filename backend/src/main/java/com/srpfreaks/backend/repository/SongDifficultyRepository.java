package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.SongDifficulty;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** 채보 조회/저장. */
public interface SongDifficultyRepository extends JpaRepository<SongDifficulty, Long> {

    Optional<SongDifficulty> findByIdAndDeletedFalse(Long id);

    List<SongDifficulty> findBySongIdAndDeletedFalse(Long songId);

    /** (곡, 파트, 난이도 종류)는 유일하다. 채보 중복 확인과 기록 연결에 쓴다. */
    Optional<SongDifficulty> findBySongIdAndInstrumentPartAndDifficultyType(
            Long songId, InstrumentPart instrumentPart, DifficultyType difficultyType);

    /**
     * 곡 목록 화면용: 삭제되지 않은 곡의 삭제되지 않은 채보 전부를 곡과 함께 한 번에 가져온다(채보마다 곡을 따로 읽으면 N+1).
     * 채보는 수백 개(시드 669개) 규모라 전부 읽어 서비스에서 묶고 거른다(서열표 화면과 같은 방식).
     */
    @Query("""
            select d from SongDifficulty d join fetch d.song s
            where d.deleted = false and s.deleted = false
            """)
    List<SongDifficulty> findAllActiveWithSong();
}
