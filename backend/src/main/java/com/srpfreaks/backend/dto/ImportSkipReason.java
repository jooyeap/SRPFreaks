package com.srpfreaks.backend.dto;

/** 가져온 플레이를 저장하지 않은 이유(D34). 화면에 사유별 개수로 보여 주므로 이름을 바꾸면 프론트도 같이 바꾼다. */
public enum ImportSkipReason {
    /** gf(Guitar/Bass)가 아닌 게임 종류 */
    UNSUPPORTED_GAME_TYPE,
    /** 브라우저 번역이 켜진 페이지에서 읽은 값(곡명이 번역돼 매칭할 수 없다) */
    TRANSLATED_PAGE,
    /** 옵션이 SRN+ + BUTTON OFF + AUTO OFF가 아님 */
    OPTION_NOT_SUPPORTED,
    /** 아직 확인하지 못한 난이도 클래스(지금은 MASTER만 읽는다) */
    UNKNOWN_DIFFICULTY,
    /** 곡 목록(마스터)에 없는 곡 또는 채보. 자동 등록하지 않는다 */
    SONG_NOT_FOUND,
    /** 같은 곡명이 마스터에 둘 이상이라 어느 곡인지 정할 수 없음 */
    AMBIGUOUS_SONG,
    /** 값이 말이 되지 않음(미래의 플레이 시각 등) */
    INVALID_VALUE,
    /** 내 기존 최고 기록보다 달성률이 낮음 */
    LOWER_THAN_BEST,
    /** 기존 최고 기록과 달성률이 같고 풀콤보도 새로 얻은 게 없음(같은 플레이를 다시 보낸 경우 포함) */
    NOT_IMPROVED
}
