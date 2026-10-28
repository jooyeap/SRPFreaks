package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 사진 입력(D55) 사용 기록 한 줄. 한도(최근 7일 n장, 하루 전체 n장)를 세는 데만 쓴다.
 * 사진·인식 결과·곡 정보는 넣지 않는다(개인정보·저작물을 남기지 않기 위해). 만든 뒤 바꾸지 않는다.
 */
@Getter
@Entity
@Table(name = "recognize_usages")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecognizeUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "recognize_usage_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 인식을 요청한 시각(UTC). */
    @Column(name = "used_at", nullable = false)
    private Instant usedAt;

    private RecognizeUsage(User user, Instant usedAt) {
        this.user = user;
        this.usedAt = usedAt;
    }

    public static RecognizeUsage of(User user, Instant usedAt) {
        return new RecognizeUsage(user, usedAt);
    }
}
