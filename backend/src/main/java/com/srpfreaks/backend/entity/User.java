package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 사용자. 로그인은 Google만 쓰므로(D19) 비밀번호 컬럼이 없다.
 * google_sub(구글 계정 고유 ID)가 본인 식별 기준이고, email은 바뀔 수 있어 보조 값이다.
 */
@Getter
@Entity
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    public static final int NICKNAME_MAX_LENGTH = 30;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long id;

    @Column(name = "google_sub", nullable = false, updatable = false, length = 64)
    private String googleSub;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "nickname", length = NICKNAME_MAX_LENGTH)
    private String nickname;

    // @Enumerated(STRING)만 쓰면 Hibernate가 MySQL에서 네이티브 ENUM 타입을 기대해 validate가 실패한다.
    // DB 컬럼은 VARCHAR(확장 대비)이므로 JDBC 타입을 VARCHAR로 고정한다. 아래 모든 enum 필드가 같은 이유로 이렇게 쓴다.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private UserStatus status;

    private User(String googleSub, String email, String nickname, Role role) {
        this.googleSub = googleSub;
        this.email = email;
        this.nickname = normalizeNickname(nickname);
        this.role = role;
        this.status = UserStatus.ACTIVE;
    }

    /** 일반 사용자를 만든다 (구글 로그인 첫 성공 시). */
    public static User create(String googleSub, String email, String nickname) {
        return create(googleSub, email, nickname, Role.USER);
    }

    /** 역할을 지정해서 만든다. ROOT 초기 계정을 환경변수로 만들 때 쓴다. */
    public static User create(String googleSub, String email, String nickname, Role role) {
        if (googleSub == null || googleSub.isBlank()) {
            throw new IllegalArgumentException("구글 계정 ID는 비워 둘 수 없습니다.");
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("이메일은 비워 둘 수 없습니다.");
        }
        if (role == null) {
            throw new IllegalArgumentException("권한은 비워 둘 수 없습니다.");
        }
        return new User(googleSub, email, nickname, role);
    }

    public void changeNickname(String nickname) {
        this.nickname = normalizeNickname(nickname);
    }

    /** 구글 쪽 이메일이 바뀌었을 때 로그인 시점에 동기화한다. */
    public void changeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("이메일은 비워 둘 수 없습니다.");
        }
        this.email = email;
    }

    public void changeRole(Role role) {
        if (role == null) {
            throw new IllegalArgumentException("권한은 비워 둘 수 없습니다.");
        }
        this.role = role;
    }

    public void block() {
        this.status = UserStatus.BLOCKED;
    }

    public void activate() {
        this.status = UserStatus.ACTIVE;
    }

    public boolean isActive() {
        return status == UserStatus.ACTIVE;
    }

    private static String normalizeNickname(String nickname) {
        if (nickname == null || nickname.isBlank()) {
            return null;
        }
        String trimmed = nickname.strip();
        if (trimmed.length() > NICKNAME_MAX_LENGTH) {
            throw new IllegalArgumentException("닉네임은 " + NICKNAME_MAX_LENGTH + "자 이하여야 합니다.");
        }
        return trimmed;
    }
}
