package com.srpfreaks.backend.repository;

/** 삭제되지 않은 곡의 id와 곡명. 곡 등록·수정 때 같은 이름이 있는지 볼 때만 쓴다. */
public record ActiveSongTitle(Long id, String title) {
}
