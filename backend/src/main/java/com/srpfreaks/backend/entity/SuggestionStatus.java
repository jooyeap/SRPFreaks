package com.srpfreaks.backend.entity;

/** 건의 처리 상태 (D35). 새 건의는 RECEIVED로 시작하고 ROOT·ADMIN이 바꾼다. */
public enum SuggestionStatus {
    RECEIVED,
    REVIEWING,
    DONE,
    REJECTED
}
