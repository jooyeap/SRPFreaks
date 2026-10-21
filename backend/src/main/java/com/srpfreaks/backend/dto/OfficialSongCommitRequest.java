package com.srpfreaks.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 미리보기에서 ROOT가 고른 항목을 반영하는 요청(D42). 공식 값을 다시 받아 서버가 차이를 다시 계산하고,
 * 고른 id가 지금도 차이 목록에 있을 때만 반영한다(미리보기 결과를 믿지 않는다).
 */
public record OfficialSongCommitRequest(
        @NotEmpty @Size(max = 300) List<@Valid OfficialSongImportRequest.OfficialSong> songs,
        @NotNull @Size(max = 300) List<Long> artistSongIds,
        @NotNull @Size(max = 1200) List<Long> levelChartIds) {
}
