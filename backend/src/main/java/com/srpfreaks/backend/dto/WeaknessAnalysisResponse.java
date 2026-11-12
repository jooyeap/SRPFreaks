package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.util.List;

/**
 * 약점 분석 (D72). 내 레이팅 목록(단일 15 + 그 외 25)과 같은 티어 공개 유저들의 레이팅 목록(D53 스냅샷)을
 * 속성별 · 난이도대별로 같은 기준에서 비교한 값이다. 유저 식별 정보나 개별 달성률은 담지 않는다(집계 평균과 인원 수만).
 *
 * - tierName / bandUsers : 내 티어 이름, 같은 티어 집계에 쓰인 공개 유저 수. peerAvailable = bandUsers가 peer.min_band_users 이상.
 *   false면 모든 peerAvg/diff가 null이고 화면은 "비교 대상이 적어요"를 보여 준다(내 값은 그대로 온다).
 * - minChartsPerBand / bandWidth : 약점 후보가 되려면 내 목록 안 채보가 이만큼 있어야 하는 최소 수, 난이도대 폭(0.5).
 * - patterns : 단일 / 복합(복합(단일) 포함) / 이중 / 삼중 순서로 항상 4줄.
 * - bands    : 내 목록에 채보가 있는 난이도대만, 기준 난이도 높은 순.
 * - weakBandFrom : 약점 난이도대의 시작 기준 난이도. 약점이 없으면 null (bands 줄의 weak와 같다).
 * - easyCharts : 약점 난이도대에서 올리기 쉬운 곡 최대 3개. 목표 = 같은 티어 유저들의 달성률 중앙값(D53).
 *
 * 평균은 소수 둘째 자리(HALF_UP). 차이(diff)는 표시된 두 평균의 차(내 평균 - 같은 티어 평균)라 화면 숫자와 어긋나지 않는다.
 */
public record WeaknessAnalysisResponse(String tierName, int bandUsers, boolean peerAvailable, int minChartsPerBand,
                                       BigDecimal bandWidth, List<PatternRow> patterns, List<BandRow> bands,
                                       BigDecimal weakBandFrom, List<EasyChart> easyCharts) {

    /** pattern = SINGLE / COMPOUND / DOUBLE / TRIPLE. myAvg는 내 목록에 그 속성이 없으면 null. peerAvg/peerUsers/diff는 비교할 수 없으면 null. */
    public record PatternRow(String pattern, int myCharts, BigDecimal myAvg, BigDecimal peerAvg, Integer peerUsers,
                             BigDecimal diff) {
    }

    /** tierFrom ~ tierTo = 묶음 범위(예 5.5 ~ 5.9). weak = 약점 난이도대. */
    public record BandRow(BigDecimal tierFrom, BigDecimal tierTo, int myCharts, BigDecimal myAvg, BigDecimal peerAvg,
                          Integer peerUsers, BigDecimal diff, boolean weak) {
    }

    /** currentRate = 내 최고 달성률(기록이 없으면 null). targetRate = 같은 티어 유저 달성률 중앙값. expectedGain = 목표를 치면 오르는 내 점수. */
    public record EasyChart(Long songDifficultyId, Long songId, String title, InstrumentPart part,
                            DifficultyType difficulty, BigDecimal level, BigDecimal tier, String pattern,
                            BigDecimal currentRate, BigDecimal targetRate, BigDecimal expectedGain, int peerUsers) {
    }
}
