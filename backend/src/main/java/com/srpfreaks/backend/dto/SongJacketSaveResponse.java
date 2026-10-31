package com.srpfreaks.backend.dto;

/** 재킷 저장 결과. saved = 새로 넣은 수, replaced = 있던 재킷을 바꾼 수. */
public record SongJacketSaveResponse(int saved, int replaced) {
}
