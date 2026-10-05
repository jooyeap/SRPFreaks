package com.srpfreaks.backend.entity;

/** 노트 옵션. 기록은 5가지 모두 저장하지만 레이팅은 app_settings의 rating.note_option(SUPER_RANDOM_PLUS)만 쓴다. */
public enum NoteOption {
    NORMAL, RANDOM, SUPER_RANDOM, RANDOM_PLUS, SUPER_RANDOM_PLUS
}
