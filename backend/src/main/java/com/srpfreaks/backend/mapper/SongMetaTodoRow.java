package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/**
 * 곡 정보 정리 목록 한 줄. titleCount는 song_titles 행 수(0이면 검색 키워드 없음).
 * bpmMin·bpmMax는 둘 다 null이면 BPM 없음(D105).
 * topPart·topDifficulty·topLevel은 그 곡의 삭제되지 않은 채보 중 레벨이 가장 높은 것(채보가 없으면 모두 null).
 */
public record SongMetaTodoRow(Long songId, String title, String artist, Integer bpmMin, Integer bpmMax, long titleCount,
                              String topPart, String topDifficulty, BigDecimal topLevel) {
}
