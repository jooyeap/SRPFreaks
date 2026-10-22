package com.srpfreaks.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 공식 곡 목록에서 북마클릿이 읽은 원시 값(D42). 읽는 쪽은 읽기만 하고, 곡 매칭·레벨 해석·차이 계산은 서버가 한다.
 * 곡 목록 페이지는 곡마다 기타/베이스 줄이 따로여서 같은 곡이 여러 번 올 수 있다. 서버가 곡명(정규화)으로 합친다.
 */
public record OfficialSongImportRequest(@NotEmpty @Size(max = 300) List<@Valid OfficialSong> songs) {

    /** 공식 곡 한 줄(곡명·아티스트와 파트별 레벨 줄). 아티스트는 비어 있을 수 있다. */
    public record OfficialSong(
            @NotBlank @Size(max = 255) String title,
            @Size(max = 255) String artist,
            @NotNull @Size(max = 8) List<@Valid OfficialChartRow> charts) {
    }

    /**
     * 한 파트의 레벨 줄.
     *
     * @param part   `G`(기타) 또는 `B`(베이스). 그 밖의 값은 서버가 무시한다
     * @param levels BSC, ADV, EXT, MAS 순서의 글자 네 개(예: "9.85"). 채보가 없으면 빈 글자 또는 "-"
     */
    public record OfficialChartRow(
            @NotBlank @Size(max = 5) String part,
            @NotNull @Size(max = 4) List<@Size(max = 10) String> levels) {
    }
}
