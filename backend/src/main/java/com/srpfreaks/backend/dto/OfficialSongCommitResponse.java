package com.srpfreaks.backend.dto;

/** 반영 결과. skipped = 고른 항목 중 지금은 차이가 아니라서(이미 반영됨 등) 건너뛴 수. */
public record OfficialSongCommitResponse(int artistFilled, int levelChanged, int skipped) {
}
