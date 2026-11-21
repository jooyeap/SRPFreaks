package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;

/**
 * 곡 정보 정리 화면(D91)의 응답: 요약 건수 + 한 페이지의 곡 목록.
 * 아티스트·키워드가 비었다는 사실은 값(artist null, titleCount 0)에서 화면이 읽는다.
 */
public record SongMetaTodoResponse(Summary summary, PageResponse<Row> page) {

    /** 건수는 모두 검색어·필터와 무관한 전체 기준. anyMissing = 아티스트 없음 + 키워드 없음 - 둘 다 없음(중복 없이 센 전체 미등록). */
    public record Summary(long totalSongs, long noArtist, long noKeyword, long bothMissing, long anyMissing) {
    }

    /** topPart·topDifficulty·topLevel은 그 곡에서 레벨이 가장 높은 채보(채보가 없으면 null). */
    public record Row(Long songId, String title, String artist, long titleCount,
                      InstrumentPart topPart, DifficultyType topDifficulty, BigDecimal topLevel) {
    }
}
