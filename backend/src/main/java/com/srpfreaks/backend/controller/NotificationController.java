package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.NotificationResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.UnreadCountResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RivalAlertService;
import com.srpfreaks.backend.service.SkillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사이트 안 알림(D56: 지금은 라이벌 역전 알림뿐). 로그인한 사용자가 자기 알림만 본다.
 * 개수·목록을 읽을 때 "보일 시각이 지난 알림"을 처리하므로(스케줄러 없음) GET이지만 알림 줄이 바뀔 수 있다.
 */
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final RivalAlertService rivalAlertService;
    private final SkillService skillService;

    @GetMapping
    public PageResponse<NotificationResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "" + RivalAlertService.DEFAULT_PAGE_SIZE) int size) {
        return rivalAlertService.list(user.id(), skillService.ratingNoteOption(), page, size);
    }

    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount(@AuthenticationPrincipal AuthenticatedUser user) {
        return new UnreadCountResponse(rivalAlertService.unreadCount(user.id(), skillService.ratingNoteOption()));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> readAll(@AuthenticationPrincipal AuthenticatedUser user) {
        rivalAlertService.markAllRead(user.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> read(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        rivalAlertService.markRead(user.id(), id);
        return ResponseEntity.noContent().build();
    }
}
