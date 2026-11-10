package com.srpfreaks.backend.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class VersionOrderTest {

    @Test
    void 출시일이_최신인_버전이_위에_온다() {
        List<String> result = VersionOrder.sorted(List.of(
                "GITADORA OverDrive", "GITADORA GALAXY WAVE", "XG", "GITADORA", "GITADORA FUZZ-UP"));

        assertThat(result).containsExactly(
                "GITADORA GALAXY WAVE", "GITADORA FUZZ-UP", "GITADORA OverDrive", "GITADORA", "XG");
    }

    @Test
    void 문자_순과_출시_순이_다른_경우도_출시_순을_따른다() {
        // 문자 순이면 EXCHAIN < Matixx < OverDrive 지만 출시 순은 EXCHAIN(2018) > Matixx(2017) > OverDrive(2014)
        assertThat(VersionOrder.sorted(List.of("GITADORA OverDrive", "GITADORA Matixx", "GITADORA EXCHAIN")))
                .containsExactly("GITADORA EXCHAIN", "GITADORA Matixx", "GITADORA OverDrive");
    }

    @Test
    void 같은_날짜는_이름_순이다() {
        // 같은 버전을 가리키는 두 표기: 정규화하면 같은 출시일이므로 이름 순
        assertThat(VersionOrder.sorted(List.of("Matixx", "GITADORA Matixx")))
                .containsExactly("GITADORA Matixx", "Matixx");
    }

    @Test
    void 표에_없는_값은_모두_맨_아래에_이름_순으로_붙고_사라지지_않는다() {
        assertThat(VersionOrder.sorted(List.of("zeta", "XG3", "Alpha", "GITADORA Matixx")))
                .containsExactly("GITADORA Matixx", "XG3", "Alpha", "zeta");
    }

    @Test
    void 중복은_제거하고_null_빈값은_제외한다() {
        assertThat(VersionOrder.sorted(Arrays.asList("V8", null, "", "  ", "V8", "XG3")))
                .containsExactly("XG3", "V8");
    }

    @Test
    void 대소문자_공백_하이픈_콜론_차이는_같은_버전이다() {
        LocalDate expected = LocalDate.of(2016, 12, 14);

        assertThat(VersionOrder.releaseDate("Tri-Boost Re:EVOLVE")).contains(expected);
        assertThat(VersionOrder.releaseDate("tri-boost re:evolve")).contains(expected);
        assertThat(VersionOrder.releaseDate("TriBoost ReEvolve")).contains(expected);
        assertThat(VersionOrder.releaseDate("GITADORA Tri-Boost Re:EVOLVE")).contains(expected);
    }

    @Test
    void 전각_문자는_NFKC로_맞춘다() {
        assertThat(VersionOrder.releaseDate("ＸＧ３")).contains(LocalDate.of(2012, 2, 23));
    }

    @Test
    void 짧은_이름은_긴_이름에_먹히지_않는다() {
        assertThat(VersionOrder.releaseDate("GALAXY WAVE")).contains(LocalDate.of(2024, 3, 13));
        assertThat(VersionOrder.releaseDate("GALAXY WAVE DELTA")).contains(LocalDate.of(2025, 3, 17));
        assertThat(VersionOrder.releaseDate("GITADORA")).contains(LocalDate.of(2013, 2, 14));
        assertThat(VersionOrder.releaseDate("GITADORA Tri-Boost")).contains(LocalDate.of(2015, 4, 21));
        // 표에 없는 접미사가 붙은 이름은 짧은 이름과 같은 버전이 아니다
        assertThat(VersionOrder.releaseDate("GITADORA GALAXY WAVE DELTA 2")).isEmpty();
        assertThat(VersionOrder.releaseDate("XG3 extra")).isEmpty();
    }

    @Test
    void 접두사가_있든_없든_같은_버전으로_맞는다() {
        assertThat(VersionOrder.releaseDate("V8")).isEqualTo(VersionOrder.releaseDate("GuitarFreaks & DrumMania V8"));
        assertThat(VersionOrder.releaseDate("Matixx")).isEqualTo(VersionOrder.releaseDate("GITADORA Matixx"));
        assertThat(VersionOrder.releaseDate("NEX+AGE")).contains(LocalDate.of(2019, 10, 2));
        assertThat(VersionOrder.releaseDate("V4 (RockxRock)")).contains(LocalDate.of(2007, 8, 8));
        assertThat(VersionOrder.releaseDate("XG")).contains(LocalDate.of(2010, 3, 10));
        assertThat(VersionOrder.releaseDate("XG2")).contains(LocalDate.of(2011, 3, 9));
    }

    @Test
    void null과_빈_값의_출시일은_없다() {
        assertThat(VersionOrder.releaseDate(null)).isEmpty();
        assertThat(VersionOrder.releaseDate("")).isEmpty();
    }
}
