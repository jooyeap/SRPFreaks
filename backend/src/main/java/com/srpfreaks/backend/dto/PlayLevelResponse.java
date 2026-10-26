package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.service.PlayLevelEstimate;

import java.math.BigDecimal;

/**
 * 내 평소 난이도(내 레이팅 목록의 서열표 기준 난이도 평균). 홈 진행도 카드가 이 값 ±0.2 안의 구간만 안내할 때 쓴다.
 * status가 READY일 때만 tier에 값이 있다(NEW_PLAYER·INSUFFICIENT면 null이고, 화면은 예전처럼 전체 구간에서 고른다).
 * 세트리스트 추천(D37)과 같은 PlayLevelEstimator를 쓰므로 두 화면의 "내 평균"이 어긋나지 않는다.
 */
public record PlayLevelResponse(PlayLevelEstimate.Status status, BigDecimal tier) {

    public static PlayLevelResponse from(PlayLevelEstimate estimate) {
        return new PlayLevelResponse(estimate.status(), estimate.tier());
    }
}
