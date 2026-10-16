package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SongSuggestionResponse;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.SongRepository.SongText;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/** 오타 보정: 접기(fold) 규칙, 편집 거리 기준, 별칭·히라가나·기호 무시, 짧은 입력과 결과 수 제한을 직접 만든 곡 목록으로 검증한다. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SongSuggestServiceTest {

    @Mock SongRepository songRepository;
    SongSuggestService service;

    private final List<SongText> titles = new ArrayList<>();
    private final List<SongText> aliases = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new SongSuggestService(songRepository);
        when(songRepository.findAllTitles()).thenReturn(titles);
        when(songRepository.findAllAliasTitles()).thenReturn(aliases);
        when(songRepository.findByIdAndDeletedFalse(anyLong())).thenAnswer(inv -> {
            long id = inv.getArgument(0);
            String title = titles.stream().filter(t -> t.songId() == id).findFirst().orElseThrow().text();
            Song song = Song.create(title, "artist", "test", null);
            ReflectionTestUtils.setField(song, "id", id);
            return Optional.of(song);
        });
        titles.add(new SongText(1L, "Prog for your Soul"));
        titles.add(new SongText(2L, "眠りの国のステラ"));
        titles.add(new SongText(3L, "天泣"));
        aliases.add(new SongText(1L, "프록 포 유어 소울"));
        aliases.add(new SongText(2L, "Nemuri no Kuni no Stella"));
    }

    private List<Long> ids(String query) {
        return service.suggest(query).stream().map(SongSuggestionResponse::songId).toList();
    }

    @Test
    void 글자_순서가_바뀌거나_하나_빠진_오타도_찾는다() {
        assertThat(ids("Prgo for your Soul")).containsExactly(1L); // o,g 바뀜(편집 2)
        assertThat(ids("Prog for you Soul")).containsExactly(1L);   // r 하나 빠짐
    }

    @Test
    void 곡명_일부만_쳐도_찾는다() {
        assertThat(ids("your soul")).containsExactly(1L);
    }

    @Test
    void 공백_기호_대소문자_전각을_무시한다() {
        assertThat(ids("PROG-FOR-YOUR-SOUL!")).containsExactly(1L);
        assertThat(ids("Ｐｒｏｇ　ｆｏｒ")).containsExactly(1L); // 전각
    }

    @Test
    void 히라가나로_쳐도_가타카나_곡명을_찾는다() {
        assertThat(ids("すてら")).containsExactly(2L); // 3글자라 오타 허용은 0이지만, 접으면 "ステラ"와 같아서 찾는다
    }

    @Test
    void 별칭에_맞아도_곡을_돌려주고_맞은_표기를_알려_준다() {
        List<SongSuggestionResponse> result = service.suggest("nemuri no kuni no stela"); // l 하나 빠짐
        assertThat(result).hasSize(1);
        assertThat(result.get(0).songId()).isEqualTo(2L);
        assertThat(result.get(0).matchedText()).isEqualTo("Nemuri no Kuni no Stella");
        assertThat(result.get(0).title()).isEqualTo("眠りの国のステラ");
    }

    @Test
    void 짧은_입력은_정확히_포함될_때만_찾는다() {
        assertThat(ids("천")).isEmpty();      // 1글자는 제안하지 않는다
        assertThat(ids("zz")).isEmpty();
        assertThat(ids("ステ")).containsExactly(2L); // 2글자라도 정확히 포함되면 찾는다
    }

    @Test
    void 비슷한_곡이_없으면_빈_목록이다() {
        assertThat(ids("Completely Different Name")).isEmpty();
        assertThat(service.suggest(null)).isEmpty();
        assertThat(service.suggest("   ")).isEmpty();
    }

    @Test
    void 결과는_다섯_곡까지다() {
        titles.clear();
        aliases.clear();
        for (long i = 1; i <= 8; i++) {
            titles.add(new SongText(i, "Stellar Song " + i));
        }
        assertThat(service.suggest("Stellar Song")).hasSize(SongSuggestService.MAX_RESULTS);
    }

    @Test
    void 편집_거리는_부분_일치로_계산한다() {
        assertThat(SongSuggestService.substringDistance("abc", "xxabcxx")).isZero();
        assertThat(SongSuggestService.substringDistance("abd", "xxabcxx")).isEqualTo(1);
        assertThat(SongSuggestService.substringDistance("abcdef", "abc")).isEqualTo(3);
        assertThat(SongSuggestService.allowedDistance(3)).isZero();
        assertThat(SongSuggestService.allowedDistance(5)).isEqualTo(1);
        assertThat(SongSuggestService.allowedDistance(12)).isEqualTo(2);
    }
}
