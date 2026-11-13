package com.srpfreaks.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.srpfreaks.backend.entity.AchievementStage;

import java.math.BigDecimal;
import java.util.List;

/**
 * 곡별 순위 응답 (D74). 채보 하나(곡 + 난이도 + 파트)의 공개 유저 순위다.
 *
 * 개인정보: 이메일·역할·Google ID 필드는 없다. userId는 유저 상세 링크용이고(D26이 이미 공개 유저의 id를 URL로 쓴다), 닉네임은 공개를 선택한 유저만 나온다.
 * 줄마다 그 유저의 플레이어 티어(key·displayName)만 담는다(닉네임 글자색용, D74 개정). 티어는 유저 목록(/players)이 이미 공개하는 값이고
 * 순위에 나온 유저는 공개 + ACTIVE뿐이라 새로 드러나는 개인 정보가 없다. 총점·다음 티어 기준점은 넣지 않는다(티어 이름 두 개만).
 * players는 "이 채보에 기록이 있는 공개 유저 수"이고 비공개 유저는 세지 않는다 -> 순위 번호와 인원으로 비공개 유저가 역산되지 않는다.
 * 인원 기준이 없어서 숨김 상태도 없다. 공개 유저가 0명이면 items는 빈 배열이고 players는 0이다.
 *
 * me: 로그인한 나의 순위(페이지와 상관없이 항상 같은 값, 요약 카드가 쓴다).
 * - null = 나는 공개 유저인데 이 채보에 SRN+ 기록이 없다.
 * - inRanking=false = 나는 공개 유저가 아니라서 순위에 없다(비공개/닉네임 없음). 화면은 "공개로 바꾸면 참여할 수 있어요" 안내를 보인다.
 *   이때 내 달성률·순위는 내려주지 않는다(비공개 유저의 값이 응답으로 나가지 않게).
 * - inRanking=true = 순위에 있다. rank·achievementRate·stage가 채워진다.
 */
public record SongRankingResponse(Long songDifficultyId, long players, int page, int size, int totalPages,
                                  Me me, List<Item> items) {

    /** isMe는 JSON 이름이 그대로 isMe가 되도록 명시한다(레코드의 boolean isMe는 기본적으로 isMe로 직렬화되지만 이름을 고정해 둔다). */
    public record Item(int rank, Long userId, String nickname, BigDecimal achievementRate, AchievementStage stage,
                       @JsonProperty("isMe") boolean isMe, Tier tier) {
    }

    /** 유저의 플레이어 티어. 화면은 key로 티어 색(data-tier)을 고른다. 티어를 정할 수 없으면 Item.tier는 null이고 화면은 기본 글자색을 쓴다. */
    public record Tier(String key, String displayName) {
    }

    public record Me(boolean inRanking, Integer rank, BigDecimal achievementRate, AchievementStage stage) {

        public static Me notInRanking() {
            return new Me(false, null, null, null);
        }

        public static Me of(int rank, BigDecimal achievementRate, AchievementStage stage) {
            return new Me(true, rank, achievementRate, stage);
        }
    }
}
