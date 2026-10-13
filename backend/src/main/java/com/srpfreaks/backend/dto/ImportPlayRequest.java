package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 공식 최근 플레이 한 건에서 읽은 원시 값(D34). 읽는 쪽(북마클릿)은 값을 읽기만 하고,
 * 옵션·난이도 해석과 풀콤보 판정은 서버가 한다(읽는 쪽을 믿지 않는다).
 *
 * @param playedAtMs      공식 페이지 `date_ms`(epoch 밀리초)
 * @param gameType        `gtype` 값. `gf`만 받는다
 * @param title           번역되지 않은 곡명 원문
 * @param difficultyClass `score_data_diff` 칸의 난이도 클래스(예: `gf_mst`, `bass_mst`)
 * @param rate            달성률 x100 정수(73.87% → 7387, MAX → 10000)
 * @param ok              OK 판정 수 (풀콤보 판정용)
 * @param miss            MISS 판정 수 (풀콤보 판정용)
 * @param translated      읽을 때 번역 흔적(font[dir=auto])이 있었는지
 * @param options         `.cc_box li` 클래스 목록(예: `gf_random_5`)
 */
public record ImportPlayRequest(
        @NotNull @Min(946_684_800_000L) Long playedAtMs,
        @NotBlank @Size(max = 10) String gameType,
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 30) String difficultyClass,
        @NotNull @Min(0) @Max(10_000) Integer rate,
        @NotNull @Min(0) @Max(100_000) Integer ok,
        @NotNull @Min(0) @Max(100_000) Integer miss,
        boolean translated,
        @NotNull @Size(max = 10) List<@NotBlank @Size(max = 40) String> options) {
}
