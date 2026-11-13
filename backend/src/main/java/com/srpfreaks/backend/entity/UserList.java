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

/**
 * 내 리스트 (D76): 이름을 붙여 오래 두는 개인 곡 모음. 나만 보고 공유하지 않는다.
 * 이름은 서비스가 NFKC·앞뒤 공백 제거로 정리한 값만 넣는다(길이 1~20자, 한 사용자 안에서 대소문자 구분 없이 중복 불가).
 * 삭제는 소프트 삭제 없이 행을 지운다(항목은 DB의 ON DELETE CASCADE로 함께 지워진다).
 */
@Getter
@Entity
@Table(name = "user_lists")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserList extends BaseTimeEntity {

    public static final int NAME_MAX_LENGTH = 20;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_list_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "name", nullable = false, length = NAME_MAX_LENGTH)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    private UserList(User user, String name, int sortOrder) {
        this.user = user;
        this.name = name;
        this.sortOrder = sortOrder;
    }

    public static UserList create(User user, String normalizedName, int sortOrder) {
        return new UserList(user, normalizedName, sortOrder);
    }

    public void rename(String normalizedName) {
        this.name = normalizedName;
    }
}
