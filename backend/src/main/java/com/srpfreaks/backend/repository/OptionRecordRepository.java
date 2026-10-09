package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.NoteOption;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 옵션 기록 조회/저장. 항상 본인(userId) 범위로만 조회한다. */
public interface OptionRecordRepository extends JpaRepository<OptionRecord, Long> {

    /**
     * 본인 기록 한 건 + 채보 + 곡을 fetch join 한 번으로 가져온다(응답에 곡 이름이 필요해서).
     * 소유자 조건을 함께 걸어, 타인의 기록이면 "없음"과 똑같이 비게 한다 -> 서비스가 404로 응답(존재 여부 비노출).
     */
    @Query("""
            select r from OptionRecord r
            join fetch r.songDifficulty d join fetch d.song
            where r.id = :recordId and r.user.id = :userId
            """)
    Optional<OptionRecord> findDetailByIdAndUserId(@Param("recordId") Long recordId, @Param("userId") Long userId);

    /**
     * 본인 기록 목록(페이지). noteOption / songDifficultyId는 null이면 조건에서 뺀다.
     * join fetch + 페이징은 컬렉션이 아니라 to-one(ManyToOne)만 fetch하므로 안전하다(메모리 페이징 경고 없음).
     * countQuery는 fetch join 없이 따로 둔다(count에 fetch join을 쓰면 오류).
     * 정렬은 Pageable의 Sort로 받는다. 화이트리스트 검증은 서비스에서 한다.
     */
    @Query(value = """
            select r from OptionRecord r
            join fetch r.songDifficulty d join fetch d.song
            where r.user.id = :userId
              and (:noteOption is null or r.noteOption = :noteOption)
              and (:songDifficultyId is null or d.id = :songDifficultyId)
            """,
            countQuery = """
            select count(r) from OptionRecord r
            where r.user.id = :userId
              and (:noteOption is null or r.noteOption = :noteOption)
              and (:songDifficultyId is null or r.songDifficulty.id = :songDifficultyId)
            """)
    Page<OptionRecord> findMine(@Param("userId") Long userId, @Param("noteOption") NoteOption noteOption,
                                @Param("songDifficultyId") Long songDifficultyId, Pageable pageable);

    /**
     * 기록 id와 소유자를 함께 조건으로 건다.
     * 타인의 기록이면 "없음"과 똑같이 비어 있게 되므로, 서비스는 이 결과로 404를 응답해 존재 여부를 숨긴다.
     */
    Optional<OptionRecord> findByIdAndUserId(Long optionRecordId, Long userId);


    /**
     * 서열표에 올라간 채보들에 대한 본인의 최고 기록을 한 번에 가져온다(채보마다 쿼리하면 N+1이 된다).
     * user_id 조건이 항상 걸리므로 다른 사용자의 기록은 섞이지 않는다.
     * 서열표의 기준 옵션(note_option)과 같은 옵션의 기록만 본다 (D20-8).
     */
    @Query("""
            select new com.srpfreaks.backend.repository.RecordBest(
                r.songDifficulty.id, max(r.achievementRate), sum(case when r.fullCombo = true then 1L else 0L end))
            from OptionRecord r
            where r.user.id = :userId
              and r.noteOption = :noteOption
              and r.songDifficulty.id in (
                  select e.songDifficulty.id from DifficultyTableEntry e where e.difficultyTable.id = :tableId)
            group by r.songDifficulty.id
            """)
    List<RecordBest> findBestByTable(@Param("userId") Long userId, @Param("noteOption") NoteOption noteOption,
                                     @Param("tableId") Long tableId);

    /**
     * 본인의 모든 채보에 대한 최고 기록을 한 번에 가져온다(곡 목록 화면: 채보마다 쿼리하면 N+1).
     * 서열표용 findBestByTable과 달리 서열표 소속 조건이 없다. user_id 조건이 항상 걸려 다른 사용자의 기록은 섞이지 않는다.
     */
    @Query("""
            select new com.srpfreaks.backend.repository.RecordBest(
                r.songDifficulty.id, max(r.achievementRate), sum(case when r.fullCombo = true then 1L else 0L end))
            from OptionRecord r
            where r.user.id = :userId and r.noteOption = :noteOption
            group by r.songDifficulty.id
            """)
    List<RecordBest> findBestByUser(@Param("userId") Long userId, @Param("noteOption") NoteOption noteOption);

    /**
     * 한 유저의 한 채보 기록 전부(관리자 삭제용, D29). 노트 옵션은 따지지 않는다(지금은 SRN+만 저장되지만 확장 대비).
     * 항상 (userId, 채보) 두 조건을 함께 건다.
     */
    List<OptionRecord> findByUserIdAndSongDifficultyId(Long userId, Long songDifficultyId);
}
