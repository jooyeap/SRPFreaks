package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Song;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 곡 조회/저장. 목록은 반드시 페이지네이션. */
public interface SongRepository extends JpaRepository<Song, Long> {

    /** 소프트 삭제된 곡은 제외한다. 곡 조회는 항상 이 메서드들로 한다. */
    Optional<Song> findByIdAndDeletedFalse(Long id);

    Page<Song> findByDeletedFalse(Pageable pageable);

    /**
     * 곡 검색: 곡명, 아티스트, 곡명 표기/별칭(정규화된 값)에 키워드가 들어 있는 곡.
     * 이스케이프 문자는 '!'를 쓴다(백슬래시는 자바/JPQL/MySQL을 거치며 해석이 달라질 수 있어서).
     * 키워드는 반드시 파라미터로만 넘긴다(문자열을 이어 붙이지 않는다). 패턴은 서비스에서 만들고 %, _를 이스케이프한다.
     */
    @Query("""
            select s from Song s
            where s.deleted = false
              and (s.title like :pattern escape '!'
                   or s.artist like :pattern escape '!'
                   or exists (select 1 from SongTitle t
                              where t.song = s and t.normalizedTitle like :normalizedPattern escape '!'))
            """)
    Page<Song> search(@Param("pattern") String pattern,
                      @Param("normalizedPattern") String normalizedPattern,
                      Pageable pageable);
}
