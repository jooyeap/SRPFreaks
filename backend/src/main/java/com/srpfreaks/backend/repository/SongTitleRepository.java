package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.SongTitle;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 곡명 표기/별칭 조회/저장. */
public interface SongTitleRepository extends JpaRepository<SongTitle, Long> {

    /** 정규화된 곡명(SongTitle.normalize 결과)으로 찾는다. 곡명 매칭용. */
    List<SongTitle> findByNormalizedTitle(String normalizedTitle);

    List<SongTitle> findBySongId(Long songId);
}
