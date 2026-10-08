package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SettingResponse;
import com.srpfreaks.backend.dto.SettingUpdateRequest;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SettingAdminService;
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

/** 운영 설정 조회·변경 API. ROOT만 부를 수 있다(ADMIN도 403). */
@RestController
@RequestMapping("/api/v1/admin/settings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ROOT')")
public class SettingAdminController {

    private final SettingAdminService settingAdminService;

    @GetMapping
    public PageResponse<SettingResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + SettingAdminService.DEFAULT_PAGE_SIZE) int size) {
        return settingAdminService.list(page, size);
    }

    /** 키는 경로에 있다. 점(.)이 들어간 키(rating.pivot)도 그대로 받는다(경로 변수 마지막 조각이라 확장자로 잘리지 않게 아래 정규식으로 받는다). */
    @PatchMapping("/{key:.+}")
    public SettingResponse update(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable String key,
                                  @Valid @RequestBody SettingUpdateRequest request) {
        return settingAdminService.update(actor.id(), key, request.value());
    }
}
