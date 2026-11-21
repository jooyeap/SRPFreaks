package com.srpfreaks.backend.mapper;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.entity.TitleKind;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.autoconfigure.MybatisAutoConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 곡 정보 정리(D91) 쿼리를 실제 MySQL(Flyway 스키마)에서 확인한다. Docker가 필요하다.
 * 모든 곡 제목에 "정리테스트" 접두사를 붙이고 검색어로 그 곡들만 보므로, 다른 데이터가 있어도 결과가 흔들리지 않는다.
 * 직접 정한 데이터: 곡 A(아티스트O·키워드O)는 목록에 없어야 하고, B(아티스트 없음), C(키워드 없음), D(둘 다 없음)가 각 필터에 알맞게 나와야 한다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class SongMetaTodoMapperTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired SongMetaTodoMapper mapper;

    Song complete;
    Song noArtist;
    Song noKeyword;
    Song both;

    @BeforeEach
    void setUp() {
        complete = song("정리테스트A 완성", "Artist A", true);
        noArtist = song("정리테스트B 아티스트없음", null, true);
        noKeyword = song("정리테스트C 키워드없음", "Artist C", false);
        both = song("정리테스트D 둘다없음", "   ", false); // 공백뿐인 아티스트도 비어 있는 것으로 본다
        em.flush();
        em.clear();
    }

    private Song song(String title, String artist, boolean withTitle) {
        Song s = Song.create(title, artist, "test", null);
        em.persist(s);
        if (withTitle) {
            em.persist(SongTitle.create(s, TitleKind.ALIAS, title + " 별칭"));
        }
        return s;
    }

    private List<Long> ids(String filter) {
        return mapper.findPage(filter, "%정리테스트%", "title", 100, 0).stream().map(SongMetaTodoRow::songId).toList();
    }

    @Test
    void 전체_미등록은_둘_중_하나라도_비어_있는_곡만_나온다() {
        assertThat(ids("ANY")).containsExactly(noArtist.getId(), noKeyword.getId(), both.getId());
        assertThat(mapper.count("ANY", "%정리테스트%")).isEqualTo(3);
    }

    @Test
    void 아티스트_없음은_둘_다_없는_곡을_포함한다() {
        assertThat(ids("ARTIST")).containsExactly(noArtist.getId(), both.getId());
    }

    @Test
    void 검색_키워드_없음은_둘_다_없는_곡을_포함한다() {
        assertThat(ids("KEYWORD")).containsExactly(noKeyword.getId(), both.getId());
    }

    @Test
    void 둘_다는_두_가지가_모두_빈_곡만_나온다() {
        assertThat(ids("BOTH")).containsExactly(both.getId());
    }

    @Test
    void 삭제된_곡은_나오지_않는다() {
        Song deleted = em.find(Song.class, both.getId());
        deleted.delete();
        em.flush();
        em.clear();

        assertThat(ids("ANY")).containsExactly(noArtist.getId(), noKeyword.getId());
    }

    @Test
    void 검색어의_퍼센트와_밑줄은_글자_그대로_찾는다() {
        // 이스케이프된 패턴('!%')은 "%" 문자가 들어 있는 곡명만 찾는다
        Song percent = song("정리테스트100% 곡", null, false);
        em.flush();
        em.clear();

        assertThat(mapper.findPage("ANY", "%100!%%", "title", 100, 0)).extracting(SongMetaTodoRow::songId)
                .containsExactly(percent.getId());
    }

    @Test
    void 대표_채보는_삭제되지_않은_채보_중_레벨이_가장_높은_것이다() {
        Song s = em.find(Song.class, noArtist.getId());
        em.persist(SongDifficulty.create(s, InstrumentPart.GUITAR, DifficultyType.EXTREME, new BigDecimal("8.20")));
        em.persist(SongDifficulty.create(s, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("9.65")));
        SongDifficulty removed = SongDifficulty.create(s, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.90"));
        em.persist(removed);
        removed.delete(); // 삭제된 채보(9.90)는 대표가 될 수 없다
        em.flush();
        em.clear();

        SongMetaTodoRow row = mapper.findPage("ARTIST", "%아티스트없음%", "title", 10, 0).get(0);
        assertThat(row.topPart()).isEqualTo("BASS");
        assertThat(row.topDifficulty()).isEqualTo("MASTER");
        assertThat(row.topLevel()).isEqualByComparingTo("9.65");
        assertThat(row.titleCount()).isEqualTo(1);
        // 채보가 없는 곡은 대표 채보가 모두 null
        SongMetaTodoRow bare = mapper.findPage("BOTH", "%둘다없음%", "title", 10, 0).get(0);
        assertThat(bare.topLevel()).isNull();
        assertThat(bare.titleCount()).isZero();
    }

    @Test
    void 레벨_정렬은_높은_레벨이_먼저이고_페이지가_나뉜다() {
        add(noArtist, "7.00");
        add(noKeyword, "9.00");
        add(both, "8.00");
        em.flush();
        em.clear();

        List<Long> byLevel = mapper.findPage("ANY", "%정리테스트%", "level", 100, 0).stream().map(SongMetaTodoRow::songId).toList();
        assertThat(byLevel).containsExactly(noKeyword.getId(), both.getId(), noArtist.getId());
        // offset으로 둘째 페이지(크기 2)를 요청하면 나머지 한 곡이 나온다
        assertThat(mapper.findPage("ANY", "%정리테스트%", "level", 2, 2)).extracting(SongMetaTodoRow::songId)
                .containsExactly(noArtist.getId());
    }

    private void add(Song s, String level) {
        em.persist(SongDifficulty.create(em.find(Song.class, s.getId()), InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal(level)));
    }

    @Test
    void 요약은_중복_없이_센다() {
        SongMetaTodoSummaryRow summary = mapper.summary();

        // 다른 데이터가 있어도 우리 곡 4개 이상은 센다. 관계식(합집합 = A + B - 둘 다)은 항상 성립한다.
        assertThat(summary.totalSongs()).isGreaterThanOrEqualTo(4);
        assertThat(summary.noArtist()).isGreaterThanOrEqualTo(2);
        assertThat(summary.noKeyword()).isGreaterThanOrEqualTo(2);
        assertThat(summary.bothMissing()).isGreaterThanOrEqualTo(1);
        assertThat(mapper.count("ANY", null)).isEqualTo(summary.noArtist() + summary.noKeyword() - summary.bothMissing());
        assertThat(mapper.count("BOTH", null)).isEqualTo(summary.bothMissing());
    }
}
