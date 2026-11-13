package com.srpfreaks.backend.dto;

/** 알림 종류. 화면은 줄 앞 칩(`라이벌` / `서열표`)으로 구분한다. */
public enum NotificationKind {
    /** 라이벌 역전 알림(D56). */
    RIVAL,
    /** 서열표 변경 알림(D61). */
    TIER
}
