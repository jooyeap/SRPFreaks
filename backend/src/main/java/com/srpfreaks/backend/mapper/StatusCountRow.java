package com.srpfreaks.backend.mapper;

/** 관리자 대시보드(D80): 건의 상태 이름과 개수. */
public record StatusCountRow(String status, long count) {
}
