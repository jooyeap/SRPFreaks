package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/** 서열표 폴더(기준 난이도 0.1 단위) 하나의 채보 수. 기록이 없는 채보도 센다(삭제된 곡·채보는 뺀다). */
public record FolderChartCountRow(BigDecimal tier, int chartCount) {
}
