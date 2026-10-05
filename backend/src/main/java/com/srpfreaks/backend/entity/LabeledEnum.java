package com.srpfreaks.backend.entity;

/**
 * DB에 한글 값 그대로 저장하는 enum용 인터페이스.
 * 서열표 시트의 값(상/중/하, 단일/복합/...)을 그대로 쓰기 위해 영문 상수 대신 label을 저장한다.
 */
public interface LabeledEnum {

    String getLabel();

    static <E extends Enum<E> & LabeledEnum> E fromLabel(Class<E> type, String label) {
        for (E constant : type.getEnumConstants()) {
            if (constant.getLabel().equals(label)) {
                return constant;
            }
        }
        throw new IllegalArgumentException("알 수 없는 값: " + label);
    }
}
