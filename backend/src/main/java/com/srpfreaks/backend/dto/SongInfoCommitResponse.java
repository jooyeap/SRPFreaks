package com.srpfreaks.backend.dto;

/** 곡 정보 저장 결과 (D90·D94). skipped = 고른 항목 중 지금은 바뀔 것이 없거나 맞지 않아 반영하지 않은 수. */
public record SongInfoCommitResponse(int artistFilled, int artistOverwritten, int bpmFilled, int bpmOverwritten, int skipped) {
}
