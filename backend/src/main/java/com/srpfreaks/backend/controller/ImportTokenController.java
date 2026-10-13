package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.ImportTokenIssueResponse;
import com.srpfreaks.backend.dto.ImportTokenStatusResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.ImportTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 가져오기 토큰 관리(D34). 로그인한 모든 사용자가 쓰며, 사용자는 토큰에서만 정한다(요청 값으로 받지 않는다).
 * 이 토큰으로 가져오기 API를 부르는 것은 별도 경로/필터이고 여기서는 발급·폐기·상태만 다룬다.
 */
@RestController
@RequestMapping("/api/v1/import-token")
@RequiredArgsConstructor
public class ImportTokenController {

    private final ImportTokenService importTokenService;

    /** 새 토큰 발급(이전 토큰은 폐기). 응답의 원문은 이때 한 번만 볼 수 있다. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ImportTokenIssueResponse issue(@AuthenticationPrincipal AuthenticatedUser user) {
        return importTokenService.issue(user.id());
    }

    @GetMapping
    public ImportTokenStatusResponse status(@AuthenticationPrincipal AuthenticatedUser user) {
        return importTokenService.status(user.id());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@AuthenticationPrincipal AuthenticatedUser user) {
        importTokenService.revoke(user.id());
    }
}
