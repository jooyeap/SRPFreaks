package com.srpfreaks.backend.mapper;

/** 곡 정보 정리 요약 건수. 아티스트 없음·키워드 없음은 둘 다 없는 곡도 포함해서 센다(전체 미등록 = 아티스트 + 키워드 - 둘 다). noBpm = bpm_min·bpm_max가 모두 NULL인 곡(D105, 전체 미등록에는 넣지 않는다). */
public record SongMetaTodoSummaryRow(long totalSongs, long noArtist, long noKeyword, long bothMissing, long noBpm) {
}
