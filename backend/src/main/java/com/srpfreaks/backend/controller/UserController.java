package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.NicknameUpdateRequest;
import com.srpfreaks.backend.dto.UserResponse;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
}
