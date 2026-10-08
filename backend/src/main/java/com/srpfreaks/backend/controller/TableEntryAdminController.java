package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.TableEntryResponse;
import com.srpfreaks.backend.dto.TableEntryUpdateRequest;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.TableEntryAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서열표 값 수정 API (ROOT·ADMIN). 곡 상세 화면의 "서열표 값 수정"이 부른다.
 * 클래스 전체에 hasRole('ADMIN')을 걸어 USER는 403이다(RoleHierarchy로 ROOT도 통과).
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class TableEntryAdminController {

    private final TableEntryAdminService tableEntryAdminService;

    @PutMapping("/difficulty-tables/{tableId}/entries/{songDifficultyId}")
    public TableEntryResponse upsert(@AuthenticationPrincipal AuthenticatedUser actor,
                                     @PathVariable Long tableId,
                                     @PathVariable Long songDifficultyId,
                                     @Valid @RequestBody TableEntryUpdateRequest request) {
        return tableEntryAdminService.upsert(actor.id(), tableId, songDifficultyId, request);
    }
}
