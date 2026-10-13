package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.SongTitle;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 곡명 표기/별칭 조회/저장. */
public interface SongTitleRepository extends JpaRepository<SongTitle, Long> {

    /** 정규화된 곡명(SongTitle.normalize 결과)으로 찾는다. 곡명 매칭용. */
    List<SongTitle> findByNormalizedTitle(String normalizedTitle);

    List<SongTitle> findBySongId(Long songId);

    /**
     * 곡의 표기를 전부 지운다(표기 교체용). 벌크 삭제는 바로 실행된다.
     * 파생 삭제(deleteBy...)를 쓰면 Hibernate가 INSERT를 DELETE보다 먼저 실행해서,
     * 같은 표기를 다시 넣을 때 유니크 키(uk_song_titles)에 걸린다.
     */
    @Modifying(flushAutomatically = true)
    @Query("delete from SongTitle t where t.song.id = :songId")
    void deleteAllBySongId(@Param("songId") Long songId);
}
