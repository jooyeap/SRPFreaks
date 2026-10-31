package com.srpfreaks.backend.entity;

/** 라이벌 알림 상태(D56). PENDING = 저장 직후(보일 시각 전, 다시 확인 전), SHOWN = 확인을 통과해 목록에 보이는 알림. */
public enum RivalNotificationStatus {
    PENDING,
    SHOWN
}
