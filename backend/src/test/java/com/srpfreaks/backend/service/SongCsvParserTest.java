package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.service.SongCsvParser.ParseResult;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/** 곡 CSV 검증: 열 이름, 값 범위, UTF-8/BOM, 모르는 열 무시. */
class SongCsvParserTest {

    private static final String HEADER = "title,part,difficulty,level,added_version,tier_label,pattern_type,source\n";

    private ParseResult parse(String csv) {
        return SongCsvParser.parse(csv.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void 정상_행을_읽고_서열표_열은_무시한다() {
        ParseResult result = parse(HEADER + "Saiph,GUITAR,MASTER,9.99,HIGH-VOLTAGE,6,단일,sheet-v1.1\n");

        assertThat(result.errors()).isEmpty();
        var row = result.rows().get(0);
        assertThat(row.title()).isEqualTo("Saiph");
        assertThat(row.part()).isEqualTo(InstrumentPart.GUITAR);
        assertThat(row.type()).isEqualTo(DifficultyType.MASTER);
        assertThat(row.level()).isEqualByComparingTo("9.99");
        assertThat(row.addedVersion()).isEqualTo("HIGH-VOLTAGE");
        assertThat(row.line()).isEqualTo(2);
    }

    @Test
    void BOM과_열_순서_대소문자와_약어를_허용한다() {
        ParseResult result = parse("﻿Level, Title ,DIFFICULTY,Part\n9.5,곡,mas,b\n");

        assertThat(result.errors()).isEmpty();
        assertThat(result.rows().get(0).part()).isEqualTo(InstrumentPart.BASS);
        assertThat(result.rows().get(0).type()).isEqualTo(DifficultyType.MASTER);
        assertThat(result.rows().get(0).level()).isEqualByComparingTo("9.50");
    }

    @Test
    void 곡명의_쉼표와_전각_문자를_처리하고_정규화_키를_만든다() {
        ParseResult result = parse(HEADER + "\"Ｎecro, Fantasia\",BASS,EXTREME,8,,,,\n");

        assertThat(result.rows().get(0).title()).isEqualTo("Ｎecro, Fantasia");
        assertThat(result.rows().get(0).normalizedTitle()).isEqualTo("necro,fantasia");
        assertThat(result.rows().get(0).addedVersion()).isNull();
    }

    @Test
    void 필수_열이_없으면_행을_읽지_않고_오류를_돌려준다() {
        ParseResult result = parse("title,part\nA,GUITAR\n");

        assertThat(result.rows()).isEmpty();
        assertThat(result.errors()).extracting(e -> e.message()).anyMatch(m -> m.contains("difficulty"))
                .anyMatch(m -> m.contains("level"));
    }

    @Test
    void 잘못된_값은_행_번호와_함께_오류로_모은다() {
        ParseResult result = parse(HEADER
                + ",GUITAR,MASTER,9,,,,\n"            // 2행: 곡명 없음
                + "A,DRUM,MASTER,9,,,,\n"             // 3행: 파트
                + "B,GUITAR,EXPERT,9,,,,\n"           // 4행: 난이도
                + "C,GUITAR,MASTER,10,,,,\n"          // 5행: 레벨 범위
                + "D,GUITAR,MASTER,9.999,,,,\n"       // 6행: 소수 셋째 자리
                + "E,GUITAR,MASTER,abc,,,,\n"         // 7행: 숫자 아님
                + "F,GUITAR,MASTER,-1,,,,\n"          // 8행
                + "G,GUITAR,MASTER,9,,,,\n");         // 9행: 정상

        assertThat(result.totalRows()).isEqualTo(8);
        assertThat(result.rows()).hasSize(1);
        assertThat(result.errors()).extracting(e -> e.line()).containsExactly(2, 3, 4, 5, 6, 7, 8);
    }

    @Test
    void 레벨_경계값() {
        ParseResult result = parse(HEADER + "A,GUITAR,MASTER,0,,,,\nB,GUITAR,MASTER,9.99,,,,\nC,GUITAR,MASTER,9.990,,,,\n");

        assertThat(result.errors()).isEmpty();
        assertThat(result.rows()).hasSize(3);
    }

    @Test
    void 빈_줄은_건너뛴다() {
        ParseResult result = parse(HEADER + "\nA,GUITAR,MASTER,9,,,,\n,,,,,,,\n");

        assertThat(result.totalRows()).isEqualTo(1);
        assertThat(result.errors()).isEmpty();
    }

    @Test
    void UTF8이_아니면_거부한다() {
        byte[] euckr = new byte[]{(byte) 0xB0, (byte) 0xA1, (byte) 0xB3, (byte) 0xAA};   // EUC-KR "가나"

        ParseResult result = SongCsvParser.parse(euckr);

        assertThat(result.rows()).isEmpty();
        assertThat(result.errors().get(0).message()).contains("UTF-8");
    }

    @Test
    void 닫히지_않은_따옴표와_빈_파일은_오류다() {
        assertThat(parse(HEADER + "\"A,GUITAR,MASTER,9\n").errors()).isNotEmpty();
        assertThat(parse("").errors()).isNotEmpty();
    }

    @Test
    void 행_수_상한을_넘으면_거부한다() {
        StringBuilder csv = new StringBuilder(HEADER);
        for (int i = 0; i <= SongCsvParser.MAX_ROWS; i++) {
            csv.append("S").append(i).append(",GUITAR,MASTER,9,,,,\n");
        }

        ParseResult result = parse(csv.toString());

        assertThat(result.rows()).isEmpty();
        assertThat(result.errors()).hasSize(1);
    }
}
