package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.NotificationResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.UnreadCountResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.NotificationService;
import com.srpfreaks.backend.service.RivalAlertService;
import com.srpfreaks.backend.service.SkillService;
import com.srpfreaks.backend.service.TierAlertService;
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
 * 사이트 안 알림: 라이벌 역전 알림(D56) + 서열표 변경 알림(D61)을 한 목록으로. 로그인한 사용자가 자기 알림만 본다.
 * 개수·목록을 읽을 때 "보일 시각이 지난 라이벌 알림"과 "마지막 확인 이후의 서열표 변경"을 처리하므로(스케줄러 없음)
 * GET이지만 알림 줄이 바뀔 수 있다.
 * 읽음 처리는 종류마다 id가 따로 매겨지므로 경로를 나눈다: 라이벌은 기존 `/{id}/read`, 서열표는 `/tier/{id}/read`.
 */
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final RivalAlertService rivalAlertService;
    private final TierAlertService tierAlertService;
    private final SkillService skillService;

    @GetMapping
    public PageResponse<NotificationResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "" + NotificationService.DEFAULT_PAGE_SIZE) int size) {
        return notificationService.list(user.id(), skillService.ratingNoteOption(), skillService.calculator(), page, size);
    }

    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount(@AuthenticationPrincipal AuthenticatedUser user) {
        return new UnreadCountResponse(notificationService.unreadCount(user.id(), skillService.ratingNoteOption(),
                skillService.calculator()));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> readAll(@AuthenticationPrincipal AuthenticatedUser user) {
        notificationService.markAllRead(user.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> read(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        rivalAlertService.markRead(user.id(), id);
        return ResponseEntity.noContent().build();
    }

    /** 서열표 변경 알림 하나를 읽음으로. 남의 알림·없는 알림은 404. */
    @PostMapping("/tier/{id}/read")
    public ResponseEntity<Void> readTier(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        tierAlertService.markRead(user.id(), id);
        return ResponseEntity.noContent().build();
    }
}
