package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.NoticeResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.service.NoticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 공지사항 목록·상세 (D30). 로그인 없이도 부를 수 있다(D43, PublicReadPaths). 읽기 전용이다. */
@RestController
@RequestMapping("/api/v1/notices")
@RequiredArgsConstructor
public class NoticeController {

    private final NoticeService noticeService;

    @GetMapping
    public PageResponse<NoticeResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + NoticeService.DEFAULT_PAGE_SIZE) int size) {
        return noticeService.list(page, size);
    }

    /** 상세(게시판의 글 보기). 없는 공지는 404. */
    @GetMapping("/{noticeId}")
    public NoticeResponse get(@PathVariable Long noticeId) {
        return noticeService.get(noticeId);
    }
}
