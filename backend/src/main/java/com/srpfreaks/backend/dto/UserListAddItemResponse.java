package com.srpfreaks.backend.dto;

/** 곡 담기 결과. 이미 담겨 있던 곡이면 오류 없이 alreadyContained=true로 돌려준다(토글을 연타해도 오류가 뜨지 않게). */
public record UserListAddItemResponse(boolean alreadyContained, long itemCount) {
}
