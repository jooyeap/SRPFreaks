package com.srpfreaks.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** 서열표 추천도. 상 / 중 / 하. */
public enum Recommend implements LabeledEnum {
    HIGH("상"), MIDDLE("중"), LOW("하");

    private final String label;

    Recommend(String label) {
        this.label = label;
    }

    @Override
    public String getLabel() {
        return label;
    }

    /** DB(VARCHAR)에는 label을 저장한다. */
    @Converter
    public static class DbConverter implements AttributeConverter<Recommend, String> {

        @Override
        public String convertToDatabaseColumn(Recommend attribute) {
            return attribute == null ? null : attribute.getLabel();
        }

        @Override
        public Recommend convertToEntityAttribute(String dbData) {
            return dbData == null ? null : LabeledEnum.fromLabel(Recommend.class, dbData);
        }
    }
}
