package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.DifficultyTableRequest;
import com.srpfreaks.backend.dto.DifficultyTableResponse;
import com.srpfreaks.backend.dto.SongImportResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.DifficultyTableService;
import com.srpfreaks.backend.service.MasterCsvExportService;
import com.srpfreaks.backend.service.SongImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * 서열표 API. 목록 조회는 로그인한 모든 사용자, 만들기·CSV 내려받기·가져오기는 ROOT·ADMIN.
 * CSV 내려받기 → 고치기 → 가져오기(미리보기 → 저장) 순서로 서열표를 관리한다.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class DifficultyTableController {

    private final DifficultyTableService difficultyTableService;
    private final MasterCsvExportService masterCsvExportService;
    private final SongImportService songImportService;

    @GetMapping("/difficulty-tables")
    public List<DifficultyTableResponse> list() {
        return difficultyTableService.list();
    }

    @PostMapping("/admin/difficulty-tables")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DifficultyTableResponse> create(@AuthenticationPrincipal AuthenticatedUser actor,
                                                          @Valid @RequestBody DifficultyTableRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(difficultyTableService.create(actor.id(), request));
    }

    @GetMapping("/admin/difficulty-tables/{tableId}/export")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> export(@PathVariable Long tableId) {
        byte[] csv = masterCsvExportService.export(tableId);
        // 파일 이름은 고정 값만 쓴다(표 이름은 사용자 입력이라 헤더에 넣지 않는다)
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("srpfreaks-master.csv").build().toString())
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .body(csv);
    }

    @PostMapping(path = "/admin/difficulty-tables/{tableId}/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public SongImportResponse importCsv(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long tableId,
                                        @RequestParam("file") MultipartFile file,
                                        @RequestParam(defaultValue = "false") boolean confirm) throws IOException {
        return songImportService.importTable(actor.id(), tableId, CsvUploads.read(file), confirm);
    }
}
