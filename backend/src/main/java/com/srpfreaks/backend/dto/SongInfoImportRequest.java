package com.srpfreaks.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 곡 정보(아티스트·BPM) 가져오기 미리보기 요청 (D90). ROOT의 브라우저가 공식 `곡별 성적` 화면에서 읽은 값이다.
 * 읽기만 하고 해석은 서버가 한다(곡명 매칭·BPM 글자 해석·정규화). 공식 화면에 값이 없으면 artist·bpm은 비어 있다.
 */
public record SongInfoImportRequest(
        @NotNull @Size(max = 4000) List<@NotNull @Valid InfoRow> songs) {

    public record InfoRow(
            @NotBlank @Size(max = 300) String title,
            @Size(max = 500) String artist,
            @Size(max = 40) String bpm) {
    }
}
