package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;

/** 라이벌 묶음 알림의 곡 한 줄(D86). 두 달성률은 그 알림을 보인 시점 값(BUNDLED 줄에 저장된 값)이다. */
public record RivalBundleSongRow(Long songDifficultyId, String title, String part, String difficulty,
                                 BigDecimal actorRate, BigDecimal myRate) {
}
