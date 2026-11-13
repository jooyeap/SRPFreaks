package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;

/**
 * "나를 라이벌로 등록한 유저"의 한 줄(D63). 공개 유저만 담기고, 닉네임·티어와 내 라이벌 여부만 내보낸다.
 * 이메일, 역할, Google ID는 일부러 필드로 만들지 않았다(실수로 내보낼 수 없게).
 * mutual = 내가 그 사람을 이미 등록했는가(그 사람은 나를 등록했으니 곧 서로 라이벌).
 */
public record RivalRegistrantResponse(Long userId, String nickname, PlayerTierResponse tier, boolean mutual) {
}
