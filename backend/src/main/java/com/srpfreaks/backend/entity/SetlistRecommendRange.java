package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 사용자가 직접 정한 세트리스트 추천 범위 (D37). 내 평균 난이도 대비 차이(음수 = 더 쉬운 곡)의 하한~상한이고
 * SS 기준 / S 기준 각각 가진다. 줄이 없으면 서버 기본값을 쓴다. 한 사용자에 한 줄(DB UNIQUE).
 * 값 검증(하한 <= 상한, -3.00~3.00, 소수 둘째 자리)은 서비스가 하고, DB CHECK가 마지막으로 한 번 더 막는다.
 */
@Getter
@Entity
@Table(name = "setlist_recommend_ranges")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SetlistRecommendRange extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "setlist_recommend_range_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "ss_min", nullable = false, precision = 4, scale = 2)
    private BigDecimal ssMin;

    @Column(name = "ss_max", nullable = false, precision = 4, scale = 2)
    private BigDecimal ssMax;

    @Column(name = "s_min", nullable = false, precision = 4, scale = 2)
    private BigDecimal sMin;

    @Column(name = "s_max", nullable = false, precision = 4, scale = 2)
    private BigDecimal sMax;

    private SetlistRecommendRange(User user, BigDecimal ssMin, BigDecimal ssMax, BigDecimal sMin, BigDecimal sMax) {
        this.user = user;
        change(ssMin, ssMax, sMin, sMax);
    }

    public static SetlistRecommendRange create(User user, BigDecimal ssMin, BigDecimal ssMax, BigDecimal sMin, BigDecimal sMax) {
        return new SetlistRecommendRange(user, ssMin, ssMax, sMin, sMax);
    }

    /** 범위를 바꾼다(@Setter 대신 의미 있는 메서드). */
    public void change(BigDecimal ssMin, BigDecimal ssMax, BigDecimal sMin, BigDecimal sMax) {
        this.ssMin = ssMin;
        this.ssMax = ssMax;
        this.sMin = sMin;
        this.sMax = sMax;
    }
}
