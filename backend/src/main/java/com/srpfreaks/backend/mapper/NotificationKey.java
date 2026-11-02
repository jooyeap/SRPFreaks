package com.srpfreaks.backend.mapper;

/** 합친 알림 목록의 한 줄 열쇠. kind = RIVAL / TIER, id = 그 종류 테이블의 PK. */
public record NotificationKey(String kind, Long id) {
}
