package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.RecognizeResultResponse;
import com.srpfreaks.backend.dto.RecognizeStatusResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RecognizeAccessPolicy;
import com.srpfreaks.backend.service.recognize.RecognizeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * 사진 입력(D55). 로그인한 사용자 누구나 상태를 물을 수 있고, 쓸 수 있는지는 RecognizeAccessPolicy가 정한다
 * (여기에 @PreAuthorize로 역할을 걸지 않는다: 공개 전환을 설정 하나로 하기 위해서다).
 * 인식 API는 같은 정책을 거친다(RecognizeService). 결과는 저장하지 않고 입력 칸 값만 돌려준다.
 */
@RestController
@RequestMapping("/api/v1/records/recognize")
@RequiredArgsConstructor
public class RecognizeController {

    private final RecognizeAccessPolicy accessPolicy;
    private final RecognizeService recognizeService;

    @GetMapping("/status")
    public RecognizeStatusResponse status(@AuthenticationPrincipal AuthenticatedUser user) {
        return accessPolicy.status(user.id(), user.role());
    }

    /** 사진 한 장(multipart의 image 칸)을 읽는다. 1MB 이하 JPEG·PNG·WebP. 사진은 저장하지 않는다. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public RecognizeResultResponse recognize(@AuthenticationPrincipal AuthenticatedUser user,
                                             @RequestPart("image") MultipartFile image) {
        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.RECOGNIZE_BAD_IMAGE);
        }
        return recognizeService.recognize(user.id(), user.role(), bytes);
    }
}
