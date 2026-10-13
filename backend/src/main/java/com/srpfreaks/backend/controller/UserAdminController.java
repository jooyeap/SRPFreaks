package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.AdminUserResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RoleChangeRequest;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.UserAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 사용자 목록·역할 변경 API. ROOT만 부를 수 있다(ADMIN도 403). */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ROOT')")
public class UserAdminController {

    private final UserAdminService userAdminService;

    @GetMapping
    public PageResponse<AdminUserResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + UserAdminService.DEFAULT_PAGE_SIZE) int size) {
        return userAdminService.list(page, size);
    }

    @PatchMapping("/{userId}/role")
    public AdminUserResponse changeRole(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long userId,
                                        @Valid @RequestBody RoleChangeRequest request) {
        return userAdminService.changeRole(actor.id(), userId, request.role());
    }
}
