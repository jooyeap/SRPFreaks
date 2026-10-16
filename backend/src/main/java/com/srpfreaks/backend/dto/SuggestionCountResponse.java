package com.srpfreaks.backend.dto;

/** 아직 처리하지 않은(RECEIVED) 건의 개수. 관리자 메뉴의 새 건의 표시에 쓴다. */
public record SuggestionCountResponse(long received) {
}
