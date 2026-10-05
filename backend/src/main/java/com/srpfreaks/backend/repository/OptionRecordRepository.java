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
     * 기록 id와 소유자를 함께 조건으로 건다.
     * 타인의 기록이면 "없음"과 똑같이 비어 있게 되므로, 서비스는 이 결과로 404를 응답해 존재 여부를 숨긴다.
     */
    Optional<OptionRecord> findByIdAndUserId(Long optionRecordId, Long userId);

    Page<OptionRecord> findByUserId(Long userId, Pageable pageable);

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
}
