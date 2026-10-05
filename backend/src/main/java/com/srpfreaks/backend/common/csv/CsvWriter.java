package com.srpfreaks.backend.common.csv;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * CSV 파일 만들기(내려받기용). UTF-8 + BOM으로 쓴다(엑셀이 BOM이 있어야 한글을 제대로 연다. 읽는 쪽은 BOM을 허용한다).
 *
 * 수식 주입(CSV injection) 방어: 칸이 = + - @ 로 시작하면 엑셀이 수식으로 실행할 수 있다.
 * 곡명은 관리자가 입력한 값이라 악성 수식이 들어 있을 수 있고, 그 파일을 다른 관리자가 엑셀로 열 수 있다.
 * 그래서 이런 칸 앞에 작은따옴표(')를 붙여서 내보내고, 다시 올릴 때 읽는 쪽이 같은 규칙으로 떼어 낸다(unescapeFormula).
 */
public final class CsvWriter {

    private static final String LINE_END = "\r\n";

    private CsvWriter() {
    }

    public static byte[] toBytes(List<String> header, List<List<String>> rows) {
        StringBuilder out = new StringBuilder("﻿");
        appendRow(out, header);
        for (List<String> row : rows) {
            appendRow(out, row);
        }
        return out.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void appendRow(StringBuilder out, List<String> cells) {
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append(quote(escapeFormula(cells.get(i))));
        }
        out.append(LINE_END);
    }

    /** 수식으로 읽힐 수 있는 시작 글자(= + - @, 탭, 줄바꿈) 앞에 '를 붙인다. */
    public static String escapeFormula(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return isFormulaStart(value.charAt(0)) ? "'" + value : value;
    }

    /** escapeFormula의 반대. '로 시작하고 그다음이 수식 시작 글자일 때만 '를 뗀다(그 밖의 '는 곡명의 일부다). */
    public static String unescapeFormula(String value) {
        if (value != null && value.length() >= 2 && value.charAt(0) == '\'' && isFormulaStart(value.charAt(1))) {
            return value.substring(1);
        }
        return value;
    }

    private static boolean isFormulaStart(char c) {
        return c == '=' || c == '+' || c == '-' || c == '@' || c == '\t' || c == '\r' || c == '\n';
    }

    private static String quote(String value) {
        boolean needsQuote = value.indexOf(',') >= 0 || value.indexOf('"') >= 0
                || value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0
                || value.startsWith(" ") || value.endsWith(" ");
        return needsQuote ? "\"" + value.replace("\"", "\"\"") + "\"" : value;
    }
}
