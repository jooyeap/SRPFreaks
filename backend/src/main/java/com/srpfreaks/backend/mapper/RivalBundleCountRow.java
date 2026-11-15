package com.srpfreaks.backend.mapper;

/** 묶음 줄 하나에 남아 있는(BUNDLED) 줄 수(D86). 삭제된 곡도 센다. */
public record RivalBundleCountRow(Long bundleId, long memberCount) {
}
