package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;

import java.math.BigDecimal;
import java.util.List;

/**
 * 내 라이벌 한 줄(D56). available=false(상대가 비공개·차단)면 닉네임과 해제만 쓰고 나머지는 null이다.
 * scoreDiff = 상대 총점 - 내 총점(양수면 상대가 높다). counts는 라이벌 대시보드와 같은 기준(두 사람이 모두 기록한 레이팅 대상 채보, 달성률 차)이다(D67 개정).
 * topSongs = 상대 레이팅 목록의 상위 곡 최대 5곡(곡 하나에 한 번만, 점수 내림차순; 3단계, D65). available=false면 null이고,
 * 볼 수 있는 상대라도 레이팅에 든 곡이 없으면 빈 목록이다. 필드는 추가만 했다(기존 필드의 이름·의미는 그대로).
 */
public record RivalResponse(Long userId, String nickname, boolean available, boolean mutual, PlayerTierResponse tier,
                            BigDecimal totalScore, BigDecimal scoreDiff, RivalCounts counts,
                            List<RivalTopSong> topSongs) {

    /** 라이벌 카드의 "상대 상위 곡" 한 칸: 재킷을 찾을 곡 id와 그 곡의 화면 점수(둘째 자리). 곡명·속성 등은 내보내지 않는다. */
    public record RivalTopSong(Long songId, BigDecimal score) {
    }

    /** 3단계 이전 모양(topSongs 없음)의 호출을 그대로 받는다. */
    public RivalResponse(Long userId, String nickname, boolean available, boolean mutual, PlayerTierResponse tier,
                         BigDecimal totalScore, BigDecimal scoreDiff, RivalCounts counts) {
        this(userId, nickname, available, mutual, tier, totalScore, scoreDiff, counts, null);
    }
}
