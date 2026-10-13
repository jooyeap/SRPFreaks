package com.srpfreaks.backend.security;

/** 검증을 통과한 구글 계정 정보. 개인정보 최소 수집 원칙에 따라 고유 ID(sub)와 이메일만 가진다. */
public record GoogleIdentity(String sub, String email) {
}
