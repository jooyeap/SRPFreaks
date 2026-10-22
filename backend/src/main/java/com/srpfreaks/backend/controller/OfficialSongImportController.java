package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.OfficialSongCommitRequest;
import com.srpfreaks.backend.dto.OfficialSongCommitResponse;
import com.srpfreaks.backend.dto.OfficialSongImportRequest;
import com.srpfreaks.backend.dto.OfficialSongPreviewResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.OfficialSongImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공식 곡 목록의 아티스트·레벨 갱신 API (D42). ROOT만 부를 수 있다(ADMIN도 403).
 * 값은 ROOT의 브라우저가 공식 페이지에서 읽어 사이트 화면으로 넘긴 것이고, 서버는 공식 사이트와 통신하지 않는다.
 * 요청 본문(공식 곡 값)은 로그에 남기지 않는다.
 */
@RestController
@RequestMapping("/api/v1/admin/song-imports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ROOT')")
public class OfficialSongImportController {

    private final OfficialSongImportService service;

    /** 저장하지 않고 마스터와의 차이(아티스트 채움·다름·레벨 변경·제외곡)만 돌려준다. */
    @PostMapping("/preview")
    public OfficialSongPreviewResponse preview(@Valid @RequestBody OfficialSongImportRequest request) {
        return service.preview(request);
    }

    /** 고른 항목을 같은 규칙으로 다시 계산해서 반영한다. */
    @PostMapping("/commit")
    public OfficialSongCommitResponse commit(@AuthenticationPrincipal AuthenticatedUser actor,
                                             @Valid @RequestBody OfficialSongCommitRequest request) {
        return service.commit(actor.id(), request);
    }
}
