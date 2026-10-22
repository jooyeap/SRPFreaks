package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Song;
import java.util.List;
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
     * 삭제되지 않은 모든 곡의 곡명. 곡 등록 때 "같은 이름이 이미 있는가"를 볼 때만 쓴다.
     * 정규화(NFKC)는 SQL로 할 수 없어서 자바에서 비교하고, 곡 수가 수천 개 수준이라 한 번에 읽어도 부담이 없다.
     */
    @Query("select new com.srpfreaks.backend.repository.ActiveSongTitle(s.id, s.title) from Song s where s.deleted = false")
    List<ActiveSongTitle> findActiveTitles();

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

    /**
     * 곡 검색과 같은 조건(곡명, 아티스트, 정규화된 표기/별칭)에 맞는 곡 id만 가져온다. 채보 단위 검색(곡 목록 화면)이
     * 이 id로 채보를 거른다. 이스케이프와 파라미터 규칙은 위 search와 같다.
     */
    @Query("""
            select s.id from Song s
            where s.deleted = false
              and (s.title like :pattern escape '!'
                   or s.artist like :pattern escape '!'
                   or exists (select 1 from SongTitle t
                              where t.song = s and t.normalizedTitle like :normalizedPattern escape '!'))
            """)
    List<Long> searchIds(@Param("pattern") String pattern, @Param("normalizedPattern") String normalizedPattern);

    /** 오타 보정 검색용: 곡 id와 표기 한 줄. 삭제된 곡은 제외한다. */
    record SongText(Long songId, String text) {
    }

    /** 곡명 후보(곡 본명). 오타 보정은 곡이 수천 개 규모라 메모리에서 비교한다(SongSuggestService). */
    @Query("select new com.srpfreaks.backend.repository.SongRepository$SongText(s.id, s.title) from Song s where s.deleted = false")
    List<SongText> findAllTitles();

    /** 곡명 후보(표기·별칭). 삭제된 곡의 표기는 제외한다. */
    @Query("select new com.srpfreaks.backend.repository.SongRepository$SongText(t.song.id, t.title) from SongTitle t where t.song.deleted = false")
    List<SongText> findAllAliasTitles();
}
