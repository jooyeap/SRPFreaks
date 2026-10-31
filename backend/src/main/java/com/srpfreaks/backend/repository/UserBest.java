package com.srpfreaks.backend.repository;

import java.math.BigDecimal;

/** 한 채보에 대한 한 사람의 최고 달성률(D56). */
public record UserBest(Long userId, BigDecimal bestRate) {
}
