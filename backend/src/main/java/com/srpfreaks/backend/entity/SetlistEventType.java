package com.srpfreaks.backend.entity;

/** 세트리스트 이력의 종류 (D52). DB에는 이름을 VARCHAR로 저장한다. */
public enum SetlistEventType {
    /** 채보를 세트리스트에 담음 */
    ADD,
    /** 사용자가 줄을 직접 뺌(`완료한 곡 비우기`는 기록하지 않는다) */
    REMOVE
}
