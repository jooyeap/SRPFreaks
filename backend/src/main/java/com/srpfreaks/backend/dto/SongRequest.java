package com.srpfreaks.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 곡 등록/수정 요청. 수정(PUT)은 보낸 값으로 통째로 교체하므로 비워서 보내면 값이 지워진다.
 * titles는 null이면 기존 표기를 그대로 두고, 빈 목록이면 모두 지운다.
 */
public record SongRequest(
        @NotBlank(message = "곡명은 필수입니다.")
        @Size(max = 255, message = "곡명은 255자 이하여야 합니다.") String title,
        @Size(max = 255, message = "아티스트는 255자 이하여야 합니다.") String artist,
        @Size(max = 30, message = "버전은 30자 이하여야 합니다.") String addedVersion,
        @Size(max = 5, message = "타이틀 폴더는 5자 이하여야 합니다.") String titleFolder,
        @Min(value = 0, message = "BPM은 0 이상이어야 합니다.")
        @Max(value = 2000, message = "BPM은 2000 이하여야 합니다.") Integer bpmMin,
        @Min(value = 0, message = "BPM은 0 이상이어야 합니다.")
        @Max(value = 2000, message = "BPM은 2000 이하여야 합니다.") Integer bpmMax,
        @Size(max = 100, message = "출처는 100자 이하여야 합니다.") String source,
        @Size(max = 20, message = "곡명 표기는 20개까지 등록할 수 있습니다.") List<@Valid SongTitleRequest> titles) {
}
