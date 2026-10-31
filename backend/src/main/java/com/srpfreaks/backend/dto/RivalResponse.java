package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;

import java.math.BigDecimal;

/**
 * 내 라이벌 한 줄(D56). available=false(상대가 비공개·차단)면 닉네임과 해제만 쓰고 나머지는 null이다.
 * scoreDiff = 상대 총점 - 내 총점(양수면 상대가 높다).
 */
public record RivalResponse(Long userId, String nickname, boolean available, boolean mutual, PlayerTierResponse tier,
                            BigDecimal totalScore, BigDecimal scoreDiff, RivalCounts counts) {
}
