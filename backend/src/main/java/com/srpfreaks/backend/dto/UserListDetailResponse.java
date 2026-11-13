package com.srpfreaks.backend.dto;

/** 내 리스트 상세: 이름과 곡 목록(페이지). 곡 수(itemCount)는 삭제된 곡·채보를 뺀 값이다. */
public record UserListDetailResponse(Long id, String name, long itemCount, PageResponse<UserListItemResponse> items) {
}
