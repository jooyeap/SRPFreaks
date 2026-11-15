package com.srpfreaks.backend.entity;

/**
 * 라이벌 알림 상태(D56). PENDING = 저장 직후(보일 시각 전, 다시 확인 전), SHOWN = 확인을 통과해 목록에 보이는 알림,
 * BUNDLED = 그날 묶음 줄에 합쳐진 곡(D86). 목록·개수·하루 3건 세기에는 나오지 않고, 묶음 줄의 "곡 목록"에서만 읽는다.
 * DB 컬럼은 VARCHAR(10)이고 CHECK가 없어 새 값을 넣는 데 마이그레이션이 필요 없다(BUNDLED는 7자).
 */
public enum RivalNotificationStatus {
    PENDING,
    SHOWN,
    BUNDLED
}
