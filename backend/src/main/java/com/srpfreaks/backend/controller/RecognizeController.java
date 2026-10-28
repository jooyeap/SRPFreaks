package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.RecognizeStatusResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RecognizeAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사진 입력(D55). 로그인한 사용자 누구나 상태를 물을 수 있고, 쓸 수 있는지는 RecognizeAccessPolicy가 정한다
 * (여기에 @PreAuthorize로 역할을 걸지 않는다: 공개 전환을 설정 하나로 하기 위해서다).
 * 인식 API(POST /records/recognize)는 다음 단계에서 같은 정책을 거쳐 추가한다.
 */
@RestController
@RequestMapping("/api/v1/records/recognize")
@RequiredArgsConstructor
public class RecognizeController {

    private final RecognizeAccessPolicy accessPolicy;

    @GetMapping("/status")
    public RecognizeStatusResponse status(@AuthenticationPrincipal AuthenticatedUser user) {
        return accessPolicy.status(user.id(), user.role());
    }
}
