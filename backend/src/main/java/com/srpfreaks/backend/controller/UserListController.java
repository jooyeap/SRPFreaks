package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.UserListAddItemRequest;
import com.srpfreaks.backend.dto.UserListAddItemResponse;
import com.srpfreaks.backend.dto.UserListDetailResponse;
import com.srpfreaks.backend.dto.UserListNameRequest;
import com.srpfreaks.backend.dto.UserListOrderRequest;
import com.srpfreaks.backend.dto.UserListSummaryResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.UserListService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 리스트 API (D76). 로그인한 사용자(USER+)가 자기 것만 다룬다(SecurityConfig의 /api/v1/** 규칙 + 서비스의 소유자 검증).
 * 공개 읽기 경로(PublicReadPaths)에 넣지 않았다: 리스트는 나만 보고 공유 링크는 없다. 남의 리스트는 404다.
 */
@RestController
@RequestMapping("/api/v1/me/lists")
@RequiredArgsConstructor
public class UserListController {

    private final UserListService userListService;

    /** songDifficultyId를 주면 각 리스트에 그 채보가 담겨 있는지(contains)를 함께 돌려준다(곡 상세 담기 시트용). */
    @GetMapping
    public PageResponse<UserListSummaryResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                      @RequestParam(required = false) Long songDifficultyId,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "" + UserListService.DEFAULT_PAGE_SIZE) int size) {
        return userListService.list(user.id(), songDifficultyId, page, size);
    }

    @PostMapping
    public ResponseEntity<UserListSummaryResponse> create(@AuthenticationPrincipal AuthenticatedUser user,
                                                          @Valid @RequestBody UserListNameRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userListService.create(user.id(), request.name()));
    }

    @GetMapping("/{listId}")
    public UserListDetailResponse detail(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long listId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "" + UserListService.MAX_PAGE_SIZE) int size) {
        return userListService.detail(user.id(), listId, page, size);
    }

    @PatchMapping("/{listId}")
    public UserListSummaryResponse rename(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long listId,
                                          @Valid @RequestBody UserListNameRequest request) {
        return userListService.rename(user.id(), listId, request.name());
    }

    @DeleteMapping("/{listId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long listId) {
        userListService.delete(user.id(), listId);
        return ResponseEntity.noContent().build();
    }

    /** 새로 담으면 201, 이미 담겨 있으면 200(alreadyContained=true). 어느 쪽이든 오류가 아니다. */
    @PostMapping("/{listId}/items")
    public ResponseEntity<UserListAddItemResponse> addItem(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long listId,
                                                           @Valid @RequestBody UserListAddItemRequest request) {
        UserListAddItemResponse result = userListService.addItem(user.id(), listId, request.songDifficultyId());
        return ResponseEntity.status(result.alreadyContained() ? HttpStatus.OK : HttpStatus.CREATED).body(result);
    }

    /** 새 순서대로 채보 id를 나열해 보낸다. 같은 경로 /items/{id}(DELETE)와 겹치지 않는다(글자 경로 order는 PUT뿐이다). */
    @PutMapping("/{listId}/items/order")
    public ResponseEntity<Void> reorder(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long listId,
                                        @Valid @RequestBody UserListOrderRequest request) {
        userListService.reorder(user.id(), listId, request.songDifficultyIds());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{listId}/items/{songDifficultyId}")
    public ResponseEntity<Void> removeItem(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long listId,
                                           @PathVariable Long songDifficultyId) {
        userListService.removeItem(user.id(), listId, songDifficultyId);
        return ResponseEntity.noContent().build();
    }
}
