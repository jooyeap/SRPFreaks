package com.srpfreaks.backend.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 서열표 변경 목록(공지 화면 `서열표 변경` 탭) 한 줄. TierHistoryRow에 곡 정보와 추천도 전·후를 더한 모양이다.
 * 감사 로그의 행위자(actor)는 가져오지 않는다(누가 바꿨는지 내보내지 않음). 시각은 DB의 UTC 값 그대로 받는다.
 */
public record TierChangeRow(String action, LocalDateTime changedAt, Long songId, String title, Long songDifficultyId,
                            String part, String difficulty, BigDecimal level, String beforeTier, String afterTier,
                            String beforePattern, String afterPattern, String beforeRecommend,
                            String afterRecommend) {
}
