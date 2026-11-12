package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.PatternType.RatingGroup;

import java.math.BigDecimal;

/**
 * 곡 상세의 "컷라인 · 목표 달성률 · 시뮬레이션" 카드용 응답 (D71). 저장하지 않고 요청 때마다 계산한 값이다.
 * 점수는 모두 화면 표시값(둘째 자리 반올림)이고, 서버 안의 계산은 반올림하지 않은 값으로 한다(D20).
 *
 * <ul>
 *   <li>status: IN_LIST(이미 목록 안) / OUT_OF_LIST(기록은 있지만 목록 밖) / NO_RECORD(레이팅 대상이지만 기록 없음) /
 *       NOT_RATED(레이팅 대상 아님, notRatedReason에 이유)</li>
 *   <li>NOT_RATED이면 group부터 cutline, simulation까지 모두 null이다(화면은 카드를 숨기고 안내만 한다).</li>
 *   <li>currentRate/currentScore/currentRank: 내 최고 기록과 그 점수, 그룹 안 순위(목록 밖이면 rank는 null).</li>
 *   <li>simulation: 요청에 achievement가 있고 대상 채보일 때만 채운다.</li>
 * </ul>
 */
public record RatingSimulationResponse(
        Status status, NotRatedReason notRatedReason,
        RatingGroup group, int groupLimit, int groupSize,
        BigDecimal currentRate, BigDecimal currentScore, Integer currentRank,
        Cutline cutline, Simulation simulation) {

    public enum Status { IN_LIST, OUT_OF_LIST, NO_RECORD, NOT_RATED }

    /**
     * 컷라인.
     * lastScore = 그룹 마지막(단일 15번째 / 그 외 25번째) 곡의 점수. 그룹이 덜 찼으면 null(= 기록만 있으면 들어간다).
     * requiredRate = "내 기록 말고 다른 곡들 기준으로, 이 채보가 목록에 들어가는 가장 낮은 달성률"(소수 둘째 자리, 올림 기준).
     *   100.00으로도 못 들어가면 null이고 reachable=false다.
     * rateGap = requiredRate - currentRate. 양수면 그만큼 더 올려야 하고, 0 이하면 이미 안이라 그만큼 여유가 있다. 기록이 없으면 null.
     * groupFull = 그룹이 가득 찼는가(목록 개수 이상).
     */
    public record Cutline(BigDecimal lastScore, BigDecimal requiredRate, boolean reachable,
                          BigDecimal rateGap, boolean groupFull) {
    }

    /**
     * 시뮬레이션 결과. achievement는 실제로 계산에 쓴 달성률이다.
     * 내 최고 기록보다 낮게 넣으면 실제로도 최고 기록은 내려가지 않으므로 최고 기록으로 계산하고 belowBest=true로 알린다.
     * entered = 이 달성률이면 목록 안인가, rank = 그때의 그룹 안 순위(밖이면 null).
     * totalBefore/totalAfter/totalChange = 레이팅 총점(단일 + 그 외) 전/후/차이.
     * pushedOut = 이 채보가 들어와서 목록에서 밀려나는 곡 1곡(없으면 null).
     */
    public record Simulation(BigDecimal achievement, boolean belowBest, boolean entered, Integer rank,
                             BigDecimal scoreAfter, BigDecimal totalBefore, BigDecimal totalAfter,
                             BigDecimal totalChange, PushedOut pushedOut) {
    }

    /** 밀려나는 곡. level은 화면의 채보 배지(`Guitar | MAS 9.93`)용 표시 레벨이다. */
    public record PushedOut(Long songDifficultyId, Long songId, String title, InstrumentPart part,
                            DifficultyType difficulty, BigDecimal level, BigDecimal score) {
    }
}
