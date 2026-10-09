package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RecordAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자의 기록 삭제 API (D29, ROOT·ADMIN). 유저 상세 화면의 "기록 삭제"가 부른다.
 * 클래스 전체에 hasRole('ADMIN')을 걸어 USER는 403이다(RoleHierarchy로 ROOT도 통과).
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class RecordAdminController {

    private final RecordAdminService recordAdminService;

    @DeleteMapping("/players/{userId}/charts/{songDifficultyId}/records")
    public ResponseEntity<Void> deleteChartRecords(@AuthenticationPrincipal AuthenticatedUser actor,
                                                   @PathVariable Long userId,
                                                   @PathVariable Long songDifficultyId) {
        recordAdminService.deleteChartRecords(actor.id(), userId, songDifficultyId);
        return ResponseEntity.noContent().build();
    }
}
