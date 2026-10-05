package com.srpfreaks.backend.controller;

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

    private final SongImportService songImportService;

    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SongImportResponse importCsv(@AuthenticationPrincipal AuthenticatedUser actor,
                                        @RequestParam("file") MultipartFile file,
                                        @RequestParam(defaultValue = "false") boolean confirm) throws IOException {
        return songImportService.importCsv(actor.id(), CsvUploads.read(file), confirm);
    }
}
