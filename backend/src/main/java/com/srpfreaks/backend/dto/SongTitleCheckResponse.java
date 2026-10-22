package com.srpfreaks.backend.dto;

/** 곡명 중복 확인 결과. 중복이면 이미 있는 곡의 id와 곡명을 같이 준다(화면에서 그 곡으로 안내). 아니면 둘 다 null. */
public record SongTitleCheckResponse(boolean duplicate, Long songId, String title) {

    public static SongTitleCheckResponse none() {
        return new SongTitleCheckResponse(false, null, null);
    }
}
