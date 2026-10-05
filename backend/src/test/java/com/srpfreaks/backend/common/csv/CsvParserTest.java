package com.srpfreaks.backend.common.csv;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CsvParserTest {

    @Test
    void 쉼표와_줄바꿈으로_나눈다() {
        assertThat(CsvParser.parse("a,b,c\n1,2,3\n"))
                .containsExactly(List.of("a", "b", "c"), List.of("1", "2", "3"));
    }

    @Test
    void 윈도우_줄바꿈과_마지막_줄바꿈_없음을_처리한다() {
        assertThat(CsvParser.parse("a,b\r\n1,2")).containsExactly(List.of("a", "b"), List.of("1", "2"));
    }

    @Test
    void 따옴표_안의_쉼표와_줄바꿈은_글자다() {
        assertThat(CsvParser.parse("\"Hello, World\",\"line1\nline2\"\n"))
                .containsExactly(List.of("Hello, World", "line1\nline2"));
    }

    @Test
    void 따옴표_두_개는_따옴표_하나다() {
        assertThat(CsvParser.parse("\"He said \"\"hi\"\"\",x\n")).containsExactly(List.of("He said \"hi\"", "x"));
    }

    @Test
    void 칸_중간의_따옴표는_그냥_글자다() {
        assertThat(CsvParser.parse("5\" disk,x\n")).containsExactly(List.of("5\" disk", "x"));
    }

    @Test
    void 빈_칸을_유지한다() {
        assertThat(CsvParser.parse("a,,c\n")).containsExactly(List.of("a", "", "c"));
    }

    @Test
    void 닫히지_않은_따옴표는_오류다() {
        assertThatThrownBy(() -> CsvParser.parse("\"abc,def\n")).isInstanceOf(CsvParser.CsvFormatException.class);
    }

    @Test
    void 빈_문자열은_행이_없다() {
        assertThat(CsvParser.parse("")).isEmpty();
    }
}
