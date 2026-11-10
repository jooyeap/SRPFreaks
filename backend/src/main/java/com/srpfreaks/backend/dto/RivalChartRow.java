package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;

/**
 * 곡별 승패 한 줄(D56). myRate는 상대만 기록 있는 줄이면 null. diff = 내 달성률 - 상대 달성률.
 * tier(서열표 기준 난이도)와 pattern(속성 라벨)은 D67 개정으로 추가했다: 곡별 승패 줄이 공통 줄(ChartLine)을 쓰게 되면서
 * 윗줄 `속성 | 서열 난이도`를 채우는 값이고, 속성 상세 목록(RivalSummaryDetailResponse.Row)의 같은 이름 필드와 형식이 같다.
 * 레이팅 대상 채보만 이 목록에 오르므로 보통 값이 있지만, 옛 응답·예외 상황을 위해 null이 올 수 있다.
 */
public record RivalChartRow(Long songDifficultyId, Long songId, String title, InstrumentPart part, DifficultyType difficulty,
                            BigDecimal level, BigDecimal myRate, BigDecimal theirRate, BigDecimal diff,
                            BigDecimal tier, String pattern) {

    /** 예전 9개 인자 생성자(tier·pattern 없음). 기존 호출처가 그대로 컴파일되게 남겨 둔다. */
    public RivalChartRow(Long songDifficultyId, Long songId, String title, InstrumentPart part, DifficultyType difficulty,
                         BigDecimal level, BigDecimal myRate, BigDecimal theirRate, BigDecimal diff) {
        this(songDifficultyId, songId, title, part, difficulty, level, myRate, theirRate, diff, null, null);
    }
}
