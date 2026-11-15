package com.srpfreaks.backend.mapper;

/** 묶음 줄 하나에 합쳐진(BUNDLED) 줄의 수와 곡명 미리보기용 곡명 한 개(D86). rn = 합친 순서(1부터). */
public record RivalBundleSummaryRow(Long bundleId, String title, int rn) {
}
