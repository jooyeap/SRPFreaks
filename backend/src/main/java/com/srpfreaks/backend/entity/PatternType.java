package com.srpfreaks.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * 채보의 주 속성(패턴 유형). 레이팅 목록 그룹을 가른다.
 * 단일 = 단일 15 그룹, 복합/이중/삼중 = 그 외 25 그룹, EXCLUDED(레이팅 제외)와 NULL은 어느 그룹에도 넣지 않는다.
 */
public enum PatternType implements LabeledEnum {
    SINGLE("단일"), COMPOUND("복합"), DOUBLE("이중"), TRIPLE("삼중"), EXCLUDED("레이팅 제외");

    private final String label;

    PatternType(String label) {
        this.label = label;
    }

    @Override
    public String getLabel() {
        return label;
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
