package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Recommend;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/** 내려받은 CSV를 그대로 다시 읽으면 같은 값이 나오는지(왕복), 수식 방어, 열 구성. */
@ExtendWith(MockitoExtension.class)
class MasterCsvExportServiceTest {

    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock DifficultyTableEntryRepository difficultyTableEntryRepository;

    MasterCsvExportService service;
    DifficultyTable table;

    @BeforeEach
    void setUp() {
        service = new MasterCsvExportService(songDifficultyRepository, difficultyTableRepository,
                difficultyTableEntryRepository);
        table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        ReflectionTestUtils.setField(table, "id", 1L);
    }

    private SongDifficulty chart(long id, String title, InstrumentPart part, DifficultyType type, String level) {
        Song song = Song.create(title, null, "sheet-v1.1", null);
        song.changeMeta("V4", null, null, null);
        SongDifficulty d = SongDifficulty.create(song, part, type, new BigDecimal(level));
        ReflectionTestUtils.setField(d, "id", id);
        return d;
    }

    private DifficultyTableEntry entry(SongDifficulty chart, String tier, boolean tierUncertain, Recommend rec,
                                       PatternType pattern) {
        DifficultyTableEntry e = DifficultyTableEntry.create(table, chart);
        e.changeTier(tier == null ? null : new BigDecimal(tier), tierUncertain, null);
        e.changeRecommend(rec, false);
        e.changePattern(pattern, false);
        return e;
    }

    @Test
    void 내려받은_파일을_다시_읽으면_같은_값이_나온다() {
        SongDifficulty a = chart(1, "Saiph", InstrumentPart.GUITAR, DifficultyType.MASTER, "9.99");
        SongDifficulty b = chart(2, "Hello, \"World\"", InstrumentPart.BASS, DifficultyType.EXTREME, "8.5");
        SongDifficulty c = chart(3, "=cmd|' /C calc'!A0", InstrumentPart.GUITAR, DifficultyType.MASTER, "7");
        SongDifficulty d = chart(4, "표에 없는 곡", InstrumentPart.GUITAR, DifficultyType.MASTER, "6");
        when(difficultyTableRepository.findById(1L)).thenReturn(Optional.of(table));
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(List.of(a, b, c, d));
        when(difficultyTableEntryRepository.findAllByDifficultyTableId(1L)).thenReturn(List.of(
                entry(a, "6.1", true, Recommend.MIDDLE, PatternType.SINGLE),
                entry(b, null, true, null, PatternType.EXCLUDED),     // 기준 난이도 "?"만
                entry(c, "7.0", false, Recommend.HIGH, PatternType.TRIPLE)));

        byte[] csv = service.export(1L);
        SongCsvParser.ParseResult parsed = SongCsvParser.parse(csv, true);

        assertThat(parsed.errors()).isEmpty();
        assertThat(parsed.rows()).hasSize(4);
        var byTitle = parsed.rows().stream().collect(java.util.stream.Collectors.toMap(r -> r.title(), r -> r));

        var saiph = byTitle.get("Saiph");
        assertThat(saiph.level()).isEqualByComparingTo("9.99");
        assertThat(saiph.addedVersion()).isEqualTo("V4");
        assertThat(saiph.source()).isEqualTo("sheet-v1.1");
        assertThat(saiph.tableValues().tier()).isEqualByComparingTo("6.1");
        assertThat(saiph.tableValues().tierUncertain()).isTrue();
        assertThat(saiph.tableValues().recommend()).isEqualTo(Recommend.MIDDLE);
        assertThat(saiph.tableValues().pattern()).isEqualTo(PatternType.SINGLE);

        var hello = byTitle.get("Hello, \"World\"");
        assertThat(hello.part()).isEqualTo(InstrumentPart.BASS);
        assertThat(hello.tableValues().tier()).isNull();
        assertThat(hello.tableValues().tierUncertain()).isTrue();
        assertThat(hello.tableValues().pattern()).isEqualTo(PatternType.EXCLUDED);

        // 수식 방어: 파일에는 '가 붙어 나가고, 다시 읽으면 원래 곡명이다
        assertThat(new String(csv, StandardCharsets.UTF_8)).contains("'=cmd|");
        assertThat(byTitle).containsKey("=cmd|' /C calc'!A0");

        // 표에 없는 채보는 값 칸이 모두 비어 있다
        var missing = byTitle.get("표에 없는 곡").tableValues();
        assertThat(missing.tier()).isNull();
        assertThat(missing.recommend()).isNull();
        assertThat(missing.pattern()).isNull();
    }

    @Test
    void 머리글은_시드_CSV와_같은_열_순서이고_BOM으로_시작한다() {
        when(difficultyTableRepository.findById(1L)).thenReturn(Optional.of(table));
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(List.of());
        when(difficultyTableEntryRepository.findAllByDifficultyTableId(1L)).thenReturn(List.of());

        String csv = new String(service.export(1L), StandardCharsets.UTF_8);

        assertThat(csv).isEqualTo("﻿title,part,difficulty,level,added_version,tier_label,tier_uncertain,"
                + "recommend,recommend_uncertain,pattern_type,pattern_uncertain,source\r\n");
    }

    @Test
    void 곡명순_파트순_난이도순으로_정렬한다() {
        SongDifficulty bass = chart(1, "Beta", InstrumentPart.BASS, DifficultyType.MASTER, "9");
        SongDifficulty gExt = chart(2, "alpha", InstrumentPart.GUITAR, DifficultyType.EXTREME, "9");
        SongDifficulty gMas = chart(3, "alpha", InstrumentPart.GUITAR, DifficultyType.MASTER, "9");
        when(difficultyTableRepository.findById(1L)).thenReturn(Optional.of(table));
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(List.of(bass, gMas, gExt));
        when(difficultyTableEntryRepository.findAllByDifficultyTableId(1L)).thenReturn(List.of());

        var parsed = SongCsvParser.parse(service.export(1L));

        assertThat(parsed.rows()).extracting(r -> r.title() + "/" + r.part() + "/" + r.type())
                .containsExactly("alpha/GUITAR/EXTREME", "alpha/GUITAR/MASTER", "Beta/BASS/MASTER");
    }

    @Test
    void 없는_서열표는_404다() {
        when(difficultyTableRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.export(9L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }
}
