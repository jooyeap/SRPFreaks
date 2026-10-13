package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * 옵션별 플레이 기록. 사용자가 직접 입력하고 계속 쌓인다(같은 채보·옵션이라도 여러 행).
 * 옵션별로 테이블을 나누지 않고 note_option 컬럼으로 구분한다.
 * 달성 단계(S/SS/FC/EXC)는 저장하지 않고 달성률과 is_full_combo로 계산한다.
 * 기록은 본인만 수정·삭제하고, 삭제는 소프트 삭제 없이 행을 지운다(D20).
 */
@Getter
@Entity
@Table(name = "option_records")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OptionRecord extends BaseTimeEntity {

    public static final BigDecimal MIN_RATE = new BigDecimal("0.00");
    public static final BigDecimal MAX_RATE = new BigDecimal("100.00");
    public static final int MEMO_MAX_LENGTH = 255;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "option_record_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "note_option", nullable = false, length = 20)
    private NoteOption noteOption;

    @Column(name = "achievement_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal achievementRate;

    @Column(name = "is_full_combo", nullable = false)
    private boolean fullCombo;

    @Column(name = "played_at", nullable = false)
    private Instant playedAt;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "platform", length = 10)
    private Platform platform;

    @Column(name = "memo", length = MEMO_MAX_LENGTH)
    private String memo;

    /** 이후 추가될 옵션용 JSON. columnDefinition은 Hibernate validate가 JSON 컬럼을 알아보게 하려는 것. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extra_options", columnDefinition = "json")
    private Map<String, Object> extraOptions;

    private OptionRecord(User user, SongDifficulty songDifficulty) {
        this.user = user;
        this.songDifficulty = songDifficulty;
    }

    /**
     * 기록을 만든다.
     *
     * @param fullCombo 입력된 FC 여부. 달성률이 100.00이면 FC가 아니어도 true로 저장한다(EXC는 곧 FC).
     * @param playedAt  null이면 저장 시각(지금)으로 한다.
     */
    public static OptionRecord create(User user, SongDifficulty songDifficulty, NoteOption noteOption,
                                      BigDecimal achievementRate, boolean fullCombo,
                                      Instant playedAt, Platform platform, String memo) {
        if (user == null || songDifficulty == null) {
            throw new IllegalArgumentException("사용자와 채보는 필수입니다.");
        }
        OptionRecord record = new OptionRecord(user, songDifficulty);
        record.apply(noteOption, achievementRate, fullCombo, playedAt, platform, memo);
        return record;
    }

    /** 기록 수정. 본인 기록만 고칠 수 있다는 검사는 서비스 계층에서 한다. */
    public void update(NoteOption noteOption, BigDecimal achievementRate, boolean fullCombo,
                       Instant playedAt, Platform platform, String memo) {
        apply(noteOption, achievementRate, fullCombo, playedAt, platform, memo);
    }

    public void changeExtraOptions(Map<String, Object> extraOptions) {
        this.extraOptions = extraOptions;
    }

    /** 이 기록의 주인인지 확인한다 (타인의 기록이면 서비스에서 404로 응답하기 위한 판단 재료). */
    public boolean isOwnedBy(Long userId) {
        return userId != null && userId.equals(user.getId());
    }

    private void apply(NoteOption noteOption, BigDecimal rate, boolean fullCombo,
                       Instant playedAt, Platform platform, String memo) {
        if (noteOption == null) {
            throw new IllegalArgumentException("노트 옵션은 필수입니다.");
        }
        BigDecimal normalized = normalizeRate(rate);
        if (memo != null && memo.length() > MEMO_MAX_LENGTH) {
            throw new IllegalArgumentException("메모는 " + MEMO_MAX_LENGTH + "자 이하여야 합니다.");
        }
        this.noteOption = noteOption;
        this.achievementRate = normalized;
        this.fullCombo = fullCombo || normalized.compareTo(MAX_RATE) == 0;
        this.playedAt = playedAt != null ? playedAt : Instant.now();
        this.platform = platform;
        this.memo = memo;
    }

    /**
     * 달성률 검증: 0.00 ~ 100.00, 소수 둘째 자리까지.
     * 95.50처럼 끝자리가 0인 셋째 자리(95.500)는 같은 값이라 허용하고, 95.555처럼 의미 있는 셋째 자리는 거부한다.
     * 결과는 항상 scale 2로 맞춘다(DB의 DECIMAL(5,2)와 같은 모양).
     */
    static BigDecimal normalizeRate(BigDecimal rate) {
        if (rate == null) {
            throw new IllegalArgumentException("달성률은 필수입니다.");
        }
        if (rate.stripTrailingZeros().scale() > 2) {
            throw new IllegalArgumentException("달성률은 소수 둘째 자리까지만 입력할 수 있습니다.");
        }
        BigDecimal scaled = rate.setScale(2);
        if (scaled.compareTo(MIN_RATE) < 0 || scaled.compareTo(MAX_RATE) > 0) {
            throw new IllegalArgumentException("달성률은 0.00 ~ 100.00 사이여야 합니다.");
        }
        return scaled;
    }
}
