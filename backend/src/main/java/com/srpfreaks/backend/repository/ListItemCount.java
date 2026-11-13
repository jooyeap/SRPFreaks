package com.srpfreaks.backend.repository;

/** 리스트별 곡 수(삭제된 곡·채보는 뺀 값). JPQL 생성자 식에서 count()는 Long으로 온다. */
public record ListItemCount(Long listId, Long count) {
}
