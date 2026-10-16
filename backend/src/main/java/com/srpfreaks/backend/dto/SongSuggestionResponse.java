package com.srpfreaks.backend.dto;

/**
 * "혹시 이 곡인가요?" 제안 한 줄. matchedText는 입력과 가장 비슷했던 표기(본명 또는 별칭)라서,
 * 본명과 다르면 화면이 "(별칭) …"처럼 함께 보여 줄 수 있다.
 */
public record SongSuggestionResponse(Long songId, String title, String artist, String matchedText) {
}
