package com.srpfreaks.backend.dto;

/** 유저 상세의 라이벌 버튼 상태(D56). registered = 내가 등록함, mutual = 상대도 나를 등록함. */
public record RivalStatusResponse(boolean registered, boolean mutual, int count, int max) {
}
