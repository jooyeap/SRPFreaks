package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;

import java.math.BigDecimal;

/**
 * 유저 목록의 한 줄(D26). 닉네임·플레이어 티어·총점·순위만 담는다.
 * 이메일, 역할, Google ID, 기록 개수 같은 값은 일부러 필드로 만들지 않았다(실수로 내보낼 수 없게).
 * userId는 상세 화면 주소에 쓰는 식별자다(닉네임은 중복될 수 있어 구분 용도).
 */
public record PlayerSummaryResponse(Long userId, int rank, String nickname, PlayerTierResponse tier,
                                    BigDecimal totalScore) {
}
