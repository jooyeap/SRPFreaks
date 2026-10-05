package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.csv.CsvParser;
import com.srpfreaks.backend.common.csv.CsvWriter;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Recommend;
import com.srpfreaks.backend.entity.SongTitle;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 곡 마스터 CSV를 읽어 검증된 행(ImportRow)과 오류 행(RowError)으로 나눈다. DB는 건드리지 않는다.
 *
 * 열 이름 규칙(docs/DESIGN.md 곡 일괄 등록): 필수 title, part, difficulty, level / 선택 added_version, source.
 * 서열표 열(tier_label, tier_uncertain, recommend, recommend_uncertain, pattern_type, pattern_uncertain)은
 * 서열표 가져오기(parse(content, true))에서만 읽고 검증한다. 곡만 올릴 때는 무시한다.
 * 그 밖의 모르는 열도 무시한다. 칸 앞의 수식 방어용 작은따옴표는 CsvWriter 규칙대로 뗀다.
 */
public final class SongCsvParser {

    public static final int MAX_ROWS = 5_000;
    private static final int MAX_TITLE = 255;
    private static final int MAX_VERSION = 30;
    private static final int MAX_SOURCE = 100;
    private static final BigDecimal MAX_LEVEL = new BigDecimal("9.99");

    private static final Map<String, InstrumentPart> PARTS = Map.of(
            "GUITAR", InstrumentPart.GUITAR, "G", InstrumentPart.GUITAR,
            "BASS", InstrumentPart.BASS, "B", InstrumentPart.BASS);
    private static final Map<String, DifficultyType> DIFFICULTIES = Map.ofEntries(
            Map.entry("BASIC", DifficultyType.BASIC), Map.entry("BAS", DifficultyType.BASIC),
            Map.entry("ADVANCED", DifficultyType.ADVANCED), Map.entry("ADV", DifficultyType.ADVANCED),
            Map.entry("EXTREME", DifficultyType.EXTREME), Map.entry("EXT", DifficultyType.EXTREME),
            Map.entry("MASTER", DifficultyType.MASTER), Map.entry("MAS", DifficultyType.MASTER));

    /**
     * 서열표 한 줄의 값. 칸이 비어 있으면 "값 없음"(미정)이다. 파일이 표의 전체 내용이라 비운 칸은 비운 값으로 반영된다.
     * 불확실 표시는 값이 없어도 가질 수 있다(기준 난이도 "?"만 있는 경우).
     */
    public record TableValues(BigDecimal tier, boolean tierUncertain, Recommend recommend, boolean recommendUncertain,
                              PatternType pattern, boolean patternUncertain) {
    }

    /** line은 파일의 행 번호(머리글이 1행)다. normalizedTitle은 곡 매칭 키다. tableValues는 서열표 모드에서만 채워진다. */
    public record ImportRow(int line, String title, String normalizedTitle, InstrumentPart part, DifficultyType type,
                            BigDecimal level, String addedVersion, String source, TableValues tableValues) {
    }

    public record RowError(int line, String message) {
    }

    public record ParseResult(int totalRows, List<ImportRow> rows, List<RowError> errors) {
    }

    private SongCsvParser() {
    }

    /** 곡·채보만 읽는다(서열표 열은 무시). */
    public static ParseResult parse(byte[] content) {
        return parse(content, false);
    }

    /** includeTable이 true면 서열표 열도 읽고 검증한다. */
    public static ParseResult parse(byte[] content, boolean includeTable) {
        String text;
        try {
            // 깨진 글자를 조용히 바꿔 넣지 않고 UTF-8이 아니면 거부한다 (곡명이 망가진 채 등록되는 것을 막는다)
            text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(content)).toString();
        } catch (CharacterCodingException e) {
            return failed("파일이 UTF-8 형식이 아닙니다.");
        }
        if (text.startsWith("﻿")) {   // 엑셀이 붙이는 BOM
            text = text.substring(1);
        }

        List<List<String>> records;
        try {
            records = CsvParser.parse(text);
        } catch (CsvParser.CsvFormatException e) {
            return failed(e.getMessage());
        }
        if (records.isEmpty()) {
            return failed("파일에 내용이 없습니다.");
        }

        Map<String, Integer> columns = new HashMap<>();
        List<String> header = records.get(0);
        for (int i = 0; i < header.size(); i++) {
            columns.putIfAbsent(header.get(i).strip().toLowerCase(Locale.ROOT), i);
        }
        List<RowError> errors = new ArrayList<>();
        for (String required : List.of("title", "part", "difficulty", "level")) {
            if (!columns.containsKey(required)) {
                errors.add(new RowError(1, "필수 열이 없습니다: " + required));
            }
        }
        if (!errors.isEmpty()) {
            return new ParseResult(0, List.of(), errors);
        }
        if (records.size() - 1 > MAX_ROWS) {
            return failed("한 번에 올릴 수 있는 행은 " + MAX_ROWS + "개까지입니다.");
        }

        List<ImportRow> rows = new ArrayList<>();
        int total = 0;
        for (int r = 1; r < records.size(); r++) {
            List<String> cells = records.get(r);
            if (cells.stream().allMatch(String::isBlank)) {
                continue;   // 빈 줄은 건너뛴다
            }
            total++;
            int line = r + 1;
            ImportRow row = parseRow(line, cells, columns, errors, includeTable);
            if (row != null) {
                rows.add(row);
            }
        }
        return new ParseResult(total, rows, errors);
    }

    private static ImportRow parseRow(int line, List<String> cells, Map<String, Integer> columns, List<RowError> errors,
                                      boolean includeTable) {
        int before = errors.size();
        String title = cell(cells, columns, "title");
        if (title.isEmpty()) {
            errors.add(new RowError(line, "곡명이 비어 있습니다."));
        } else if (title.length() > MAX_TITLE) {
            errors.add(new RowError(line, "곡명은 " + MAX_TITLE + "자 이하여야 합니다."));
        }
        InstrumentPart part = PARTS.get(cell(cells, columns, "part").toUpperCase(Locale.ROOT));
        if (part == null) {
            errors.add(new RowError(line, "파트는 GUITAR 또는 BASS여야 합니다."));
        }
        DifficultyType type = DIFFICULTIES.get(cell(cells, columns, "difficulty").toUpperCase(Locale.ROOT));
        if (type == null) {
            errors.add(new RowError(line, "난이도는 BASIC, ADVANCED, EXTREME, MASTER 중 하나여야 합니다."));
        }
        BigDecimal level = parseLevel(cell(cells, columns, "level"));
        if (level == null) {
            errors.add(new RowError(line, "레벨은 0.00 ~ 9.99 사이, 소수 둘째 자리까지 입력해야 합니다."));
        }
        String version = cell(cells, columns, "added_version");
        if (version.length() > MAX_VERSION) {
            errors.add(new RowError(line, "초출 버전은 " + MAX_VERSION + "자 이하여야 합니다."));
        }
        String source = cell(cells, columns, "source");
        if (source.length() > MAX_SOURCE) {
            errors.add(new RowError(line, "출처는 " + MAX_SOURCE + "자 이하여야 합니다."));
        }
        TableValues table = includeTable ? parseTableValues(line, cells, columns, errors) : null;
        if (errors.size() > before) {
            return null;
        }
        return new ImportRow(line, title, SongTitle.normalize(title), part, type, level,
                version.isEmpty() ? null : version, source.isEmpty() ? null : source, table);
    }

    private static TableValues parseTableValues(int line, List<String> cells, Map<String, Integer> columns,
                                                List<RowError> errors) {
        int before = errors.size();
        BigDecimal tier = parseTier(cell(cells, columns, "tier_label"));
        if (tier == INVALID) {
            errors.add(new RowError(line, "기준 난이도는 0.0 이상, 소수 첫째 자리까지 입력해야 합니다."));
        }
        Recommend recommend = null;
        String recommendText = cell(cells, columns, "recommend");
        if (!recommendText.isEmpty()) {
            recommend = byLabel(Recommend.values(), recommendText);
            if (recommend == null) {
                errors.add(new RowError(line, "추천도는 상, 중, 하 중 하나여야 합니다."));
            }
        }
        PatternType pattern = null;
        String patternText = cell(cells, columns, "pattern_type");
        if (!patternText.isEmpty()) {
            pattern = byLabel(PatternType.values(), patternText);
            if (pattern == null) {
                errors.add(new RowError(line, "속성은 단일, 복합, 이중, 삼중, 레이팅 제외 중 하나여야 합니다."));
            }
        }
        Boolean tierUncertain = flag(cell(cells, columns, "tier_uncertain"));
        Boolean recommendUncertain = flag(cell(cells, columns, "recommend_uncertain"));
        Boolean patternUncertain = flag(cell(cells, columns, "pattern_uncertain"));
        if (tierUncertain == null || recommendUncertain == null || patternUncertain == null) {
            errors.add(new RowError(line, "불확실 표시 열은 1 또는 빈 칸이어야 합니다."));
        }
        if (errors.size() > before) {
            return null;
        }
        return new TableValues(tier, tierUncertain, recommend, recommendUncertain, pattern, patternUncertain);
    }

    /** 잘못된 값을 null(= 미정)과 구분하려고 쓰는 표식. */
    private static final BigDecimal INVALID = new BigDecimal("-1");

    private static BigDecimal parseTier(String text) {
        if (text.isEmpty()) {
            return null;
        }
        try {
            BigDecimal tier = new BigDecimal(text);
            if (tier.signum() < 0 || tier.compareTo(new BigDecimal("99.9")) > 0 || tier.stripTrailingZeros().scale() > 1) {
                return INVALID;
            }
            return tier.setScale(1);
        } catch (NumberFormatException e) {
            return INVALID;
        }
    }

    /** 빈 칸/0/false는 false, 1/true는 true, 그 밖의 값은 null(오류). */
    private static Boolean flag(String text) {
        return switch (text.toLowerCase(Locale.ROOT)) {
            case "", "0", "false" -> Boolean.FALSE;
            case "1", "true" -> Boolean.TRUE;
            default -> null;
        };
    }

    private static <E extends Enum<E> & com.srpfreaks.backend.entity.LabeledEnum> E byLabel(E[] values, String label) {
        for (E value : values) {
            if (value.getLabel().equals(label)) {
                return value;
            }
        }
        return null;
    }

    private static BigDecimal parseLevel(String text) {
        try {
            BigDecimal level = new BigDecimal(text);
            if (level.signum() < 0 || level.compareTo(MAX_LEVEL) > 0 || level.stripTrailingZeros().scale() > 2) {
                return null;
            }
            return level.setScale(2);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String cell(List<String> cells, Map<String, Integer> columns, String name) {
        Integer index = columns.get(name);
        if (index == null || index >= cells.size()) {
            return "";
        }
        return CsvWriter.unescapeFormula(cells.get(index).strip());
    }

    private static ParseResult failed(String message) {
        return new ParseResult(0, List.of(), List.of(new RowError(0, message)));
    }
}
