package com.srpfreaks.backend.common.csv;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CsvWriterTest {

    private String write(List<String> header, List<List<String>> rows) {
        return new String(CsvWriter.toBytes(header, rows), StandardCharsets.UTF_8);
    }

    @Test
    void BOM과_줄바꿈을_붙이고_쉼표_따옴표_줄바꿈이_있는_칸은_따옴표로_감싼다() {
        String csv = write(List.of("a", "b"), List.of(List.of("x,y", "he said \"hi\""), List.of("line1\nline2", "plain")));

        assertThat(csv).startsWith("﻿");
        assertThat(csv).isEqualTo("﻿a,b\r\n\"x,y\",\"he said \"\"hi\"\"\"\r\n\"line1\nline2\",plain\r\n");
    }

    @Test
    void 수식으로_읽힐_수_있는_칸_앞에_작은따옴표를_붙인다() {
        assertThat(CsvWriter.escapeFormula("=1+1")).isEqualTo("'=1+1");
        assertThat(CsvWriter.escapeFormula("+81")).isEqualTo("'+81");
        assertThat(CsvWriter.escapeFormula("-Fantasy-")).isEqualTo("'-Fantasy-");
        assertThat(CsvWriter.escapeFormula("@SUM(A1)")).isEqualTo("'@SUM(A1)");
        assertThat(CsvWriter.escapeFormula("\tcmd")).isEqualTo("'\tcmd");
        assertThat(CsvWriter.escapeFormula("Saiph")).isEqualTo("Saiph");
        assertThat(CsvWriter.escapeFormula("")).isEmpty();
        assertThat(CsvWriter.escapeFormula(null)).isEmpty();
    }

    @Test
    void 떼어_내기는_수식_시작_글자가_뒤따르는_작은따옴표만_뗀다() {
        assertThat(CsvWriter.unescapeFormula("'=1+1")).isEqualTo("=1+1");
        assertThat(CsvWriter.unescapeFormula("'-Fantasy-")).isEqualTo("-Fantasy-");
        assertThat(CsvWriter.unescapeFormula("'Hello")).isEqualTo("'Hello");
        assertThat(CsvWriter.unescapeFormula("'")).isEqualTo("'");
        assertThat(CsvWriter.unescapeFormula("Saiph")).isEqualTo("Saiph");
    }

    @Test
    void 쓴_CSV를_파서로_읽으면_원래_값이_돌아온다() {
        List<String> titles = List.of("Hello, World", "He said \"hi\"", "=cmd|' /C calc'!A0", "-Fantasy-", "줄\n바꿈", " 앞뒤 공백 ", "ネクロファンタジア");
        List<List<String>> rows = titles.stream().map(t -> List.of(t, "x")).toList();

        List<List<String>> parsed = CsvParser.parse(write(List.of("title", "v"), rows).substring(1));

        assertThat(parsed.stream().skip(1).map(r -> CsvWriter.unescapeFormula(r.get(0))).toList()).isEqualTo(titles);
    }
}
