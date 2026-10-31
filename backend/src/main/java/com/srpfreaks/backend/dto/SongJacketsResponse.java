package com.srpfreaks.backend.dto;

import java.util.Map;

/**
 * 재킷 주소 목록(D54 3단계). enabled = 운영 설정 ui.show_song_images. 꺼져 있으면 jackets는 비어 있다(모든 화면에서 즉시 사라짐).
 * 화면은 이 목록 하나를 받아 두고 곡 id로 찾아 쓴다(곡 목록·서열표·레이팅 응답마다 주소를 붙이지 않으려고).
 */
public record SongJacketsResponse(boolean enabled, Map<Long, String> jackets) {
}
