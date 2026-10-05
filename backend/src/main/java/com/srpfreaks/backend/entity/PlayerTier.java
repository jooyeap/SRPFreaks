package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 플레이어 티어 구간표(0 ~ 9,500+ 20단계). 시드로 들어가고 ROOT만 값을 고친다.
 * 사용자의 티어는 저장하지 않고, 점수 합계의 정수부 이상인 min_score 중 가장 큰 행으로 계산한다.
 */
@Getter
@Entity
@Table(name = "player_tiers")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlayerTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "player_tier_id")
    private Long id;

    @Column(name = "tier_key", nullable = false, length = 30)
    private String tierKey;

    @Column(name = "display_name", nullable = false, length = 30)
    private String displayName;

    @Column(name = "min_score", nullable = false)
    private int minScore;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public void change(String displayName, int minScore) {
        if (displayName == null || displayName.isBlank()) {
            throw new IllegalArgumentException("표시 이름은 비어 있을 수 없다.");
        }
        if (minScore < 0) {
            throw new IllegalArgumentException("시작 점수는 음수일 수 없다.");
        }
        this.displayName = displayName;
        this.minScore = minScore;
    }
}
