package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.SongJacketsResponse;
import com.srpfreaks.backend.service.SongJacketQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 재킷 주소 목록(D54). 공개 GET(PublicReadPaths에 정확한 경로로 등록). `/songs/{songId}`보다 글자 경로가 먼저 맞는다. */
@RestController
@RequestMapping("/api/v1/songs/jackets")
@RequiredArgsConstructor
public class SongJacketController {

    private final SongJacketQueryService songJacketQueryService;

    @GetMapping
    public SongJacketsResponse jackets() {
        return songJacketQueryService.jackets();
    }
}
