package com.srpfreaks.backend.common.csv;

import java.util.ArrayList;
import java.util.List;

/**
 * 최소한의 CSV 파서(RFC 4180 방식). 외부 라이브러리를 늘리지 않으려고 직접 만들었다.
 * - 쉼표로 열을 나누고, 줄바꿈(\n, \r\n, \r)으로 행을 나눈다.
 * - 큰따옴표로 감싼 칸 안에서는 쉼표와 줄바꿈이 글자로 취급되고, 큰따옴표 두 개("")는 큰따옴표 하나다.
 *   (곡명에 쉼표나 따옴표가 들어 있어도 안전하게 읽는다)
 * - 칸이 큰따옴표로 시작하지 않으면 중간의 큰따옴표는 그냥 글자다.
 */
public final class CsvParser {

    private CsvParser() {
    }

    /** 닫히지 않은 따옴표처럼 형식이 깨진 파일. 메시지는 그대로 사용자에게 보여줘도 되는 문구다. */
    public static class CsvFormatException extends RuntimeException {
        public CsvFormatException(String message) {
            super(message);
        }
    }

    public static List<List<String>> parse(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean inQuotes = false;
        boolean atFieldStart = true;

        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field.append(c);
                }
                continue;
            }
            switch (c) {
                case '"' -> {
                    if (atFieldStart) {
                        inQuotes = true;
                    } else {
                        field.append(c);
                    }
                    atFieldStart = false;
                }
                case ',' -> {
                    row.add(field.toString());
                    field.setLength(0);
                    atFieldStart = true;
                }
                case '\r', '\n' -> {
                    if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                        i++;
                    }
                    row.add(field.toString());
                    field.setLength(0);
                    rows.add(row);
                    row = new ArrayList<>();
                    atFieldStart = true;
                }
                default -> {
                    field.append(c);
                    atFieldStart = false;
                }
            }
        }
        if (inQuotes) {
            throw new CsvFormatException("닫히지 않은 따옴표가 있습니다.");
        }
        if (!atFieldStart || !row.isEmpty()) {   // 마지막 줄에 줄바꿈이 없는 경우
            row.add(field.toString());
            rows.add(row);
        }
        return rows;
    }
}
