package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.NicknameUpdateRequest;
import com.srpfreaks.backend.dto.UserResponse;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.security.RefreshCookieFactory;
import com.srpfreaks.backend.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final UserProfileService userProfileService;
    private final RefreshCookieFactory cookieFactory;

    /** 내 정보. 누구의 정보인지는 토큰에서만 정한다(요청 값으로 사용자 ID를 받지 않는다). */
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AuthenticatedUser principal) {
        return userRepository.findById(principal.id())
                .map(UserResponse::from)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
    }

    /** 내 닉네임 변경(빈 값이면 닉네임 없음). 사용자 ID는 요청 본문이 아니라 토큰에서만 정한다. */
    @PatchMapping("/me")
    public UserResponse updateMyNickname(@AuthenticationPrincipal AuthenticatedUser principal,
                                         @Valid @RequestBody NicknameUpdateRequest request) {
        return userProfileService.updateNickname(principal.id(), request.nickname());
    }

    /**
     * 회원 탈퇴(완전 삭제, D20). 성공하면 204.
     * refresh 쿠키는 Path=/api/v1/auth라 이 경로 요청에는 실리지 않지만, 응답의 Set-Cookie로는 같은 Path의 쿠키를 지울 수 있다.
     * 그래서 클라이언트가 로그아웃을 따로 부르지 않아도 브라우저의 쿠키가 한 번에 지워진다.
     */
    @DeleteMapping("/me")
    public ResponseEntity<Void> withdraw(@AuthenticationPrincipal AuthenticatedUser principal) {
        userProfileService.withdraw(principal.id());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookieFactory.clear().toString())
                .build();
    }
}
