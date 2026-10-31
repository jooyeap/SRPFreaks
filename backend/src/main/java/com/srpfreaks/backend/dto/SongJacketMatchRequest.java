package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** 재킷 가져오기(D54) 1단계: 공식 `곡별 성적` 페이지의 곡명 목록(이미지는 아직 보내지 않는다). 2026-10-28 기준 1,646곡. */
public record SongJacketMatchRequest(
        @NotNull @Size(max = 4000) List<@NotNull @Size(min = 1, max = 300) String> titles) {
}
