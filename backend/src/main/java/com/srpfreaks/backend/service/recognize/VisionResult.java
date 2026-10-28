package com.srpfreaks.backend.service.recognize;

/**
 * 비전 모델이 돌려준 값 그대로(검증 전). 모델의 도구 입력(JSON) 칸과 1:1이다. 읽지 못하면 null.
 * 플레이어 이름·ID 칸은 일부러 없다(모델에게 묻지도 않는다).
 */
public record VisionResult(String title, String part, String difficulty, String level, String achievementRate,
                           Integer missCount, Boolean fullCombo, Boolean superRandomPlus) {
}
