package com.srpfreaks.backend.dto;

import java.util.List;

/**
 * 곡 정보(아티스트·BPM) 가져오기 미리보기 결과 (D90·D94). 마스터와 곡명이 맞은 곡만 줄로 돌려준다(새 곡은 만들지 않는다).
 * 줄마다 현재값 → 가져온 값과 상태를 담고, 화면이 상태를 글자로 보여 준다.
 */
public record SongInfoPreviewResponse(int readSongs, int matchedSongs, int unmatchedCount, List<Row> rows) {

    /** FILL=새로 채움, OVERWRITE=덮어쓰기, UNCHANGED=변경 없음, NONE=값 없음(가져온 값이 없거나 읽을 수 없음). */
    public enum Status { FILL, OVERWRITE, UNCHANGED, NONE }

    public record ArtistChange(String current, String official, Status status) {
    }

    public record BpmChange(Integer currentMin, Integer currentMax, Integer officialMin, Integer officialMax, Status status) {
    }

    public record Row(String officialTitle, Long songId, String songTitle, ArtistChange artist, BpmChange bpm) {
    }
}
