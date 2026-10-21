package com.srpfreaks.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 공식 곡 목록과 마스터를 비교한 결과(D42). 저장하지 않는다.
 * 새 곡·새 채보는 만들지 않으므로 마스터에 없는 곡은 개수와 곡명으로만 알린다.
 */
public record OfficialSongPreviewResponse(
        int readSongs,
        int matchedSongs,
        int unchangedSongs,
        int unmatchedCount,
        List<String> unmatchedTitles,
        List<ArtistFill> artistFills,
        List<ArtistMismatch> artistMismatches,
        List<LevelChange> levelChanges) {

    /** 마스터의 아티스트가 비어 있는 곡: 공식 아티스트로 채울 후보. */
    public record ArtistFill(Long songId, String title, String officialArtist) {
    }

    /** 이미 아티스트가 있는데 공식과 다른 곡. 표시만 하고 반영하지 않는다(수동 표기 차이일 수 있다). */
    public record ArtistMismatch(Long songId, String title, String currentArtist, String officialArtist) {
    }

    /** 이미 있는 채보의 레벨이 공식과 다른 것(버전이 바뀌면서 난이도가 수정되는 경우). */
    public record LevelChange(Long songDifficultyId, Long songId, String title, String part, String difficultyType,
                              BigDecimal currentLevel, BigDecimal officialLevel) {
    }
}
