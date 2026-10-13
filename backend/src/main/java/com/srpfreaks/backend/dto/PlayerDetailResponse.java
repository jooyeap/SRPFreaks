package com.srpfreaks.backend.dto;

/**
 * 유저 상세(D26, 읽기 전용): 닉네임과 그 유저의 레이팅 목록(SkillResponse = 합계·티어·단일 15·복합·이중·삼중 25).
 * 내 레이팅(/skills/me)과 같은 계산 결과를 그대로 쓴다.
 */
public record PlayerDetailResponse(Long userId, String nickname, SkillResponse skill) {
}
