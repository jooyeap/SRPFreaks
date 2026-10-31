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
 * 내가 등록한 라이벌 한 줄(D56). 등록한 사람(user) → 상대(target) 방향이고, 반대 방향 줄도 있으면 "서로 라이벌"이다.
 * 만든 뒤 바꾸지 않는다(해제는 줄을 지운다). 사용자가 지워지면 DB의 ON DELETE CASCADE로 함께 지워진다.
 *
 * 연관관계는 LAZY: 목록에서 상대 닉네임이 필요할 때만 읽는다(RivalRepository의 fetch join 쿼리).
 */
@Getter
@Entity
@Table(name = "rivals")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Rival {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "rival_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_user_id", nullable = false)
    private User target;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    private Rival(User user, User target, Instant createdAt) {
        this.user = user;
        this.target = target;
        this.createdAt = createdAt;
    }

    public static Rival of(User user, User target, Instant createdAt) {
        if (user.getId() != null && user.getId().equals(target.getId())) {
            throw new IllegalArgumentException("자기 자신은 라이벌로 등록할 수 없습니다.");
        }
        return new Rival(user, target, createdAt);
    }
}
