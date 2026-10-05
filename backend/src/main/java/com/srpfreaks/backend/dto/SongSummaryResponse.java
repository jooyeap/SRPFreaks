package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Song;

/** 곡 목록 한 줄. 채보와 표기는 상세에서만 내려 N+1을 피한다. */
public record SongSummaryResponse(Long id, String title, String artist, String addedVersion, String titleFolder,
                                  Integer bpmMin, Integer bpmMax) {

    public static SongSummaryResponse from(Song s) {
        return new SongSummaryResponse(s.getId(), s.getTitle(), s.getArtist(), s.getAddedVersion(),
                s.getTitleFolder(), s.getBpmMin(), s.getBpmMax());
    }
}
