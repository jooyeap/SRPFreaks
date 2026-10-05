package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SongImportResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** 곡 마스터 CSV 일괄 등록 (ROOT·ADMIN). confirm=false면 미리보기, true면 저장. */
@RestController
@RequestMapping("/api/v1/admin/songs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SongImportController {

    /** 시드(465곡·669채보)가 약 50KB라 여유를 두고 2MB로 제한한다. 서버 설정(multipart)에도 같은 상한을 둔다. */
    static final long MAX_FILE_BYTES = 2L * 1024 * 1024;

    private final SongImportService songImportService;

    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SongImportResponse importCsv(@AuthenticationPrincipal AuthenticatedUser actor,
                                        @RequestParam("file") MultipartFile file,
                                        @RequestParam(defaultValue = "false") boolean confirm) throws IOException {
        if (file.isEmpty() || file.getSize() > MAX_FILE_BYTES) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        // 파일 이름과 Content-Type은 사용자가 마음대로 보낼 수 있어 믿지 않는다. 내용만 UTF-8 CSV로 검증한다.
        return songImportService.importCsv(actor.id(), file.getBytes(), confirm);
    }
}
