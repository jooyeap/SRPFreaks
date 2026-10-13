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
 * 공식 최근 플레이 가져오기(D34). 이 경로는 로그인 토큰이 아니라 **가져오기 전용 토큰**(Authorization: Bearer srpi_…)만 받는다
 * (ImportTokenAuthenticationFilter, SecurityConfig). 사용자는 토큰에서만 정하고 요청 본문에 사용자 id를 받지 않는다.
 * 요청 본문·원본 HTML은 로그에 남기지 않는다.
 */
@RestController
@RequestMapping("/api/v1/imports")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    @PostMapping("/recent-plays")
    public ImportResultResponse importRecentPlays(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @Valid @RequestBody ImportRecentPlaysRequest request) {
        return importService.importRecentPlays(user.id(), request);
    }
}
