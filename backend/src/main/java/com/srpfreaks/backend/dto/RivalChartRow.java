package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;

/** 곡별 승패 한 줄(D56). myRate는 상대만 기록 있는 줄이면 null. diff = 내 달성률 - 상대 달성률. */
public record RivalChartRow(Long songDifficultyId, Long songId, String title, InstrumentPart part, DifficultyType difficulty,
                            BigDecimal level, BigDecimal myRate, BigDecimal theirRate, BigDecimal diff) {
}
