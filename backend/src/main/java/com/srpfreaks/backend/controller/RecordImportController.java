package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.ImportRecentPlaysRequest;
import com.srpfreaks.backend.dto.ImportResultResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.ImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사이트 화면에서 최근 플레이를 확인하고 저장하는 API (D40). 가져오기 토큰 없이 **로그인한 계정(Access Token)** 으로 부른다.
 * 공식 페이지의 북마클릿은 값을 읽어 사이트 창으로 넘기기만 하고, 이 API를 부르는 것은 사이트 화면(사용자의 확인 뒤)이다.
 * 사용자는 인증에서만 정하고 요청 본문에 사용자 id를 받지 않는다. 요청 본문은 로그에 남기지 않는다.
 */
@RestController
@RequestMapping("/api/v1/record-imports")
@RequiredArgsConstructor
public class RecordImportController {

    private final ImportService importService;

    /** 저장하지 않고 건별 결과(저장될 건·건너뜀 사유·제외곡·기존 최고 기록)만 돌려준다. */
    @PostMapping("/preview")
    public ImportResultResponse preview(@AuthenticationPrincipal AuthenticatedUser user,
                                        @Valid @RequestBody ImportRecentPlaysRequest request) {
        return importService.previewRecentPlays(user.id(), request);
    }

    /** 사용자가 고른 플레이만 받아 같은 규칙으로 다시 걸러 저장한다(미리보기 결과를 믿지 않는다). */
    @PostMapping("/commit")
    public ImportResultResponse commit(@AuthenticationPrincipal AuthenticatedUser user,
                                       @Valid @RequestBody ImportRecentPlaysRequest request) {
        return importService.importRecentPlays(user.id(), request);
    }
}
