package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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

import java.math.BigDecimal;

/**
 * 난이도표의 한 줄 = 표에 올라간 채보 하나와 그 채보의 기준 난이도·추천도·속성.
 * "?"가 붙은 값(불확실)은 *_uncertain 플래그로 따로 저장한다.
 * 사용자 달성률은 여기에 저장하지 않고, (곡, 난이도, 파트)로 사용자 본인의 기록을 연결해서 보여 준다.
 */
@Getter
@Entity
@Table(name = "difficulty_table_entries")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DifficultyTableEntry extends BaseTimeEntity {

    public static final int COMMENT_MAX_LENGTH = 255;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "difficulty_table_entry_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "difficulty_table_id", nullable = false)
    private DifficultyTable difficultyTable;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    /** 기준 난이도(T), 0.1 단위, 클수록 어렵다. NULL이면 미정이고 레이팅 계산에서 제외한다. */
    @Column(name = "tier_label", precision = 3, scale = 1)
    private BigDecimal tierLabel;

    @Column(name = "tier_uncertain", nullable = false)
    private boolean tierUncertain;

    @Column(name = "tier_order")
    private Integer tierOrder;

    @Convert(converter = Recommend.DbConverter.class)
    @Column(name = "recommend", length = 10)
    private Recommend recommend;

    @Column(name = "recommend_uncertain", nullable = false)
    private boolean recommendUncertain;

    @Convert(converter = PatternType.DbConverter.class)
    @Column(name = "pattern_type", length = 20)
    private PatternType patternType;

    @Column(name = "pattern_uncertain", nullable = false)
    private boolean patternUncertain;

    @Column(name = "comment", length = COMMENT_MAX_LENGTH)
    private String comment;

    private DifficultyTableEntry(DifficultyTable difficultyTable, SongDifficulty songDifficulty) {
        this.difficultyTable = difficultyTable;
        this.songDifficulty = songDifficulty;
    }

    public static DifficultyTableEntry create(DifficultyTable difficultyTable, SongDifficulty songDifficulty) {
        if (difficultyTable == null || songDifficulty == null) {
            throw new IllegalArgumentException("난이도표와 채보는 필수입니다.");
        }
        return new DifficultyTableEntry(difficultyTable, songDifficulty);
    }

    /**
     * 기준 난이도를 정한다. null이면 미정이다.
     * 값 없이 "?"만 있는 경우(DESIGN.md 곡 일괄 등록 규칙)를 표현하려고 값이 null이어도 uncertain=true를 그대로 둔다.
     * (미정으로 되돌릴 때는 uncertain=false로 호출한다)
     */
    public void changeTier(BigDecimal tierLabel, boolean uncertain, Integer tierOrder) {
        if (tierLabel != null) {
            BigDecimal stripped = tierLabel.stripTrailingZeros();
            if (tierLabel.signum() < 0 || stripped.scale() > 1 || tierLabel.compareTo(new BigDecimal("99.9")) > 0) {
                throw new IllegalArgumentException("기준 난이도는 0.0 이상, 소수 첫째 자리까지 입력할 수 있습니다.");
            }
            tierLabel = tierLabel.setScale(1);
        }
        this.tierLabel = tierLabel;
        this.tierUncertain = uncertain;
        this.tierOrder = tierOrder;
    }

    public void changeRecommend(Recommend recommend, boolean uncertain) {
        this.recommend = recommend;
        this.recommendUncertain = recommend != null && uncertain;
    }

    public void changePattern(PatternType patternType, boolean uncertain) {
        this.patternType = patternType;
        this.patternUncertain = patternType != null && uncertain;
    }

    public void changeComment(String comment) {
        if (comment != null && comment.length() > COMMENT_MAX_LENGTH) {
            throw new IllegalArgumentException("코멘트는 " + COMMENT_MAX_LENGTH + "자 이하여야 합니다.");
        }
        this.comment = comment;
    }

    /**
     * 레이팅 대상인가: 기준 난이도와 속성이 모두 있고, 속성이 '레이팅 제외'가 아니어야 한다.
     * 하나라도 없으면 레이팅 목록에서 빼고 기록만 남긴다(D18).
     */
    public boolean isRatable() {
        return tierLabel != null && patternType != null && patternType != PatternType.EXCLUDED;
    }

    /** 단일 15 그룹에 들어가는가. */
    public boolean isSingleGroup() {
        return isRatable() && patternType == PatternType.SINGLE;
    }

    /** 그 외 25 그룹(복합·이중·삼중)에 들어가는가. */
    public boolean isOtherGroup() {
        return isRatable() && patternType != PatternType.SINGLE;
    }
}
