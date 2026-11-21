package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.SongInfoCommitRequest;
import com.srpfreaks.backend.dto.SongInfoCommitResponse;
import com.srpfreaks.backend.dto.SongInfoImportRequest;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongInfoImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 곡 정보(아티스트·BPM) 가져오기 API (D90). ROOT만 부를 수 있다(ADMIN도 403).
 * 값은 ROOT의 브라우저가 공식 `곡별 성적` 화면에서 읽어 사이트 화면으로 넘긴 것이고, 서버는 공식 사이트와 통신하지 않는다.
 * 요청 본문(공식 곡 값)은 로그에 남기지 않는다.
 */
@RestController
@RequestMapping("/api/v1/admin/song-info-imports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ROOT')")
public class SongInfoImportController {

    private final SongInfoImportService service;

    /** 저장하지 않고 마스터와 곡명이 맞은 곡의 현재값 → 가져온 값과 상태만 돌려준다. */
    @PostMapping("/preview")
    public SongInfoPreviewResponse preview(@Valid @RequestBody SongInfoImportRequest request) {
        return service.preview(request);
    }

    /** 고른 곡·항목을 같은 규칙으로 다시 계산해서 반영한다. */
    @PostMapping("/commit")
    public SongInfoCommitResponse commit(@AuthenticationPrincipal AuthenticatedUser actor,
                                         @Valid @RequestBody SongInfoCommitRequest request) {
        return service.commit(actor.id(), request);
    }
}
