package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.SongInfoImportRequest.InfoRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 곡 정보 가져오기 저장 요청 (D90). songs는 미리보기와 같은 공식 값(고른 곡만 보내도 된다),
 * selections는 곡마다 어느 항목을 저장할지다. 서버가 다시 계산해서 지금도 바뀔 것이 있을 때만 반영한다.
 */
public record SongInfoCommitRequest(
        @NotNull @Size(max = 4000) List<@NotNull @Valid InfoRow> songs,
        @NotNull @Size(max = 4000) List<@NotNull @Valid Selection> selections) {

    public record Selection(@NotNull Long songId, boolean artist, boolean bpm) {
    }
}
