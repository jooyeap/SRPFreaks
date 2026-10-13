package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.entity.TitleKind;

import java.util.List;

/** 곡 상세: 곡 정보 + 곡명 표기 + 채보. image_url은 정책(D7, D21)이 정해질 때까지 내보내지 않는다. */
public record SongDetailResponse(Long id, String title, String artist, String addedVersion, String titleFolder,
                                 Integer bpmMin, Integer bpmMax, String source,
                                 List<TitleResponse> titles, List<DifficultyResponse> difficulties) {

    public record TitleResponse(TitleKind kind, String title) {
    }

    public static SongDetailResponse of(Song s, List<SongTitle> titles, List<SongDifficulty> difficulties) {
        return new SongDetailResponse(s.getId(), s.getTitle(), s.getArtist(), s.getAddedVersion(), s.getTitleFolder(),
                s.getBpmMin(), s.getBpmMax(), s.getSource(),
                titles.stream().map(t -> new TitleResponse(t.getKind(), t.getTitle())).toList(),
                difficulties.stream().map(DifficultyResponse::from).toList());
    }
}
