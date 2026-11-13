package com.srpfreaks.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * 채보의 주 속성(패턴 유형). 레이팅 목록 그룹을 가른다.
 * 단일 = 단일 15 그룹, 복합/이중/삼중/복합(단일) = 그 외 25 그룹, EXCLUDED(레이팅 제외)와 NULL은 어느 그룹에도 넣지 않는다.
 * 그룹 판정은 {@link #ratingGroup()} 한 곳에서만 한다(D62).
 */
public enum PatternType implements LabeledEnum {
    SINGLE("단일"), COMPOUND("복합"), DOUBLE("이중"), TRIPLE("삼중"), EXCLUDED("레이팅 제외"),
    COMPOSITE_SINGLE("복합(단일)");

    /** 레이팅 목록에서 어느 그룹에 속하는가. */
    public enum RatingGroup { SINGLE, OTHER, NONE }

    private final String label;

    PatternType(String label) {
        this.label = label;
    }

    @Override
    public String getLabel() {
        return label;
    }

    /**
     * 레이팅 그룹 판정을 모은 한 곳(D62). 서비스와 엔티티는 속성 값을 직접 비교하지 않고 이 메서드만 본다.
     * 복합(단일)은 지금은 그 외(OTHER)다. 나중에 다른 규칙을 붙이면 여기만 고치면 된다.
     */
    public RatingGroup ratingGroup() {
        return switch (this) {
            case SINGLE -> RatingGroup.SINGLE;
            case COMPOUND, DOUBLE, TRIPLE, COMPOSITE_SINGLE -> RatingGroup.OTHER;
            case EXCLUDED -> RatingGroup.NONE;
        };
    }

    /** NULL 속성은 레이팅 제외와 같이 NONE으로 본다. */
    public static RatingGroup ratingGroupOf(PatternType pattern) {
        return pattern == null ? RatingGroup.NONE : pattern.ratingGroup();
    }

    /** DB(VARCHAR)에는 label을 저장한다. */
    @Converter
    public static class DbConverter implements AttributeConverter<PatternType, String> {

        @Override
        public String convertToDatabaseColumn(PatternType attribute) {
            return attribute == null ? null : attribute.getLabel();
        }

        @Override
        public PatternType convertToEntityAttribute(String dbData) {
            return dbData == null ? null : LabeledEnum.fromLabel(PatternType.class, dbData);
        }
    }
}
