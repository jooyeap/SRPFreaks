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

import java.text.Normalizer;
import java.util.regex.Pattern;
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

    /** 닉네임 길이는 글자(코드 포인트) 수로 센다. 12자 제한은 여기서 검사하고, DB 컬럼은 30으로 둬서 제한만 바꿀 때 스키마를 건드리지 않는다. */
    public static final int NICKNAME_MIN_LENGTH = 2;
    public static final int NICKNAME_MAX_LENGTH = 12;
    public static final int NICKNAME_COLUMN_LENGTH = 30;

    /**
     * 허용 문자: 영문, 숫자, 히라가나, 가타카나, 한자, 그리고 ー ・ 々 〆 〇 _ - (한글과 공백은 불가).
     * ー(장음), ・(가운뎃점), 々 〆 〇(한자 반복·기호)는 문자 종류가 "공통"으로 분류돼 스크립트 검사에 안 걸리므로 따로 적었다.
     * 々는 佐々木처럼 일본어 이름에 흔해서 빠지면 안 된다(처음에는 빠져서 거부되는 것을 확인하고 추가했다).
     * 자바 정규식은 코드 포인트 단위로 동작해서 𠮷 같은 드문 한자(UTF-16 두 칸)도 한 글자로 본다.
     */
    private static final Pattern NICKNAME_PATTERN =
            Pattern.compile("^[A-Za-z0-9_\\-ー・々〆〇\\p{IsHiragana}\\p{IsKatakana}\\p{IsHan}]+$");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long id;

    @Column(name = "google_sub", nullable = false, updatable = false, length = 64)
    private String googleSub;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "nickname", length = NICKNAME_COLUMN_LENGTH)
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
        // NFKC: 반각 가타카나(ｶﾀｶﾅ)는 전각으로, 전각 영문·숫자(Ａ１)는 반각으로 맞춘다.
        // 모양만 다른 같은 닉네임이 여러 개 생기는 것을 막는다.
        String normalized = Normalizer.normalize(nickname, Normalizer.Form.NFKC).strip();
        // String.length()는 UTF-16 단위라 드문 한자를 2로 센다. 사용자가 보는 글자 수와 맞추려고 코드 포인트로 센다.
        int length = normalized.codePointCount(0, normalized.length());
        if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
            throw new IllegalArgumentException(
                    "닉네임은 " + NICKNAME_MIN_LENGTH + "자 이상 " + NICKNAME_MAX_LENGTH + "자 이하여야 합니다.");
        }
        if (!NICKNAME_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException(
                    "닉네임은 영문, 숫자, 일본어(히라가나·가타카나·한자)와 ー ・ _ - 만 사용할 수 있습니다.");
        }
        return normalized;
    }
}
