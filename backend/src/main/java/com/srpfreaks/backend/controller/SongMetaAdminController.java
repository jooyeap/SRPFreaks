package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.SongMetaTodoResponse;
import com.srpfreaks.backend.service.SongMetaTodoService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 곡 정보 정리 API (D91, ROOT·ADMIN). 읽기 전용 목록 하나뿐이다. 저장·되돌리기는 기존 곡 수정 API(PUT /api/v1/songs/{id})를 쓰고,
 * 곡 삭제·신규 등록은 이 화면에서 하지 않는다. 공개 읽기 경로(PublicReadPaths)에 넣지 않았다.
 * 권한은 두 겹이다: 주소 규칙(/api/v1/admin/** → ADMIN 이상), 이 클래스의 @PreAuthorize. USER는 403, 비로그인은 401이다.
 * 읽기 전용이라 감사 로그는 쓰지 않는다.
 */
@RestController
@RequestMapping("/api/v1/admin/song-meta")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SongMetaAdminController {

    private final SongMetaTodoService songMetaTodoService;

    /**
     * filter = ANY(전체 미등록, 기본) / ARTIST / KEYWORD / BOTH / BPM(D105), q = 곡명 검색어, sort = title(기본) / level(레벨 높은 순).
     * 허용 밖 값은 400이다.
     */
    @GetMapping("/todo")
    public SongMetaTodoResponse todo(@RequestParam(required = false) String filter,
                                     @RequestParam(required = false) String q,
                                     @RequestParam(required = false) String sort,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "" + SongMetaTodoService.DEFAULT_PAGE_SIZE) int size) {
        return songMetaTodoService.list(filter, q, sort, page, size);
    }
}
