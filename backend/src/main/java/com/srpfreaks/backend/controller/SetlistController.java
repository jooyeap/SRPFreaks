package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SetlistAddRequest;
import com.srpfreaks.backend.dto.SetlistItemResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SetlistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 세트리스트 API (D36). 로그인한 사용자(USER+)가 자기 것만 다룬다(SecurityConfig의 /api/v1/** 규칙 + 서비스의 userId 조건).
 * 완료한 줄 비우기는 DELETE /setlist/done이고, 숫자 id 경로(/{id})와 겹치지 않는다(글자 경로가 먼저 맞는다).
 */
@RestController
@RequestMapping("/api/v1/setlist")
@RequiredArgsConstructor
public class SetlistController {

    private final SetlistService setlistService;

    @GetMapping
    public PageResponse<SetlistItemResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "" + SetlistService.MAX_PAGE_SIZE) int size) {
        return setlistService.list(user.id(), page, size);
    }

    @PostMapping
    public ResponseEntity<SetlistItemResponse> add(@AuthenticationPrincipal AuthenticatedUser user,
                                                   @Valid @RequestBody SetlistAddRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(setlistService.add(user.id(), request.songDifficultyId()));
    }

    @DeleteMapping("/{setlistItemId}")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long setlistItemId) {
        setlistService.remove(user.id(), setlistItemId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/done")
    public Map<String, Integer> clearDone(@AuthenticationPrincipal AuthenticatedUser user) {
        return Map.of("removed", setlistService.clearDone(user.id()));
    }
}
