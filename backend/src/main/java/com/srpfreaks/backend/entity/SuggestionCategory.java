package com.srpfreaks.backend.entity;

/** 건의 종류 (D35). DB에는 이름 그대로 저장하므로 이름을 바꾸지 않는다. */
public enum SuggestionCategory {
    /** 곡 추가 요청. 관리자가 읽고 직접 등록한다(자동 등록 없음). */
    SONG_REQUEST,
    IMPROVEMENT,
    BUG,
    OTHER
}
