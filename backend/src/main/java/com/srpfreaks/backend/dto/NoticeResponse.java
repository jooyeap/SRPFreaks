package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.Notice;

import java.time.Instant;

/** 공지 응답. 쓴 사람은 내보내지 않는다. 시각은 UTC이고 화면이 Asia/Seoul로 바꾼다. */
public record NoticeResponse(Long id, String title, String content, Instant createdAt, Instant updatedAt) {

    public static NoticeResponse from(Notice notice) {
        return new NoticeResponse(notice.getId(), notice.getTitle(), notice.getContent(),
                notice.getCreatedAt(), notice.getUpdatedAt());
    }
}
