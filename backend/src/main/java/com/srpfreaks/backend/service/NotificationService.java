package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.NotificationResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.RivalNotificationStatus;
import com.srpfreaks.backend.entity.TierNotification;
import com.srpfreaks.backend.mapper.NotificationKey;
import com.srpfreaks.backend.mapper.NotificationMapper;
import com.srpfreaks.backend.repository.RivalNotificationRepository;
import com.srpfreaks.backend.repository.TierNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 알림 목록(헤더 종). 라이벌 역전 알림(D56)과 서열표 변경 알림(D61)을 한 목록에 시간순으로 섞는다.
 *
 * 읽을 때마다 두 알림의 "읽을 때 처리"를 먼저 한다(스케줄러 없음):
 *  - 라이벌: 보일 시각이 지난 PENDING을 다시 확인해서 보이거나 지운다(RivalAlertService.refresh)
 *  - 서열표: 마지막 확인 이후의 서열표 변경으로 알림을 만든다(TierAlertService.deliver)
 * 그래서 GET이지만 알림 줄이 바뀔 수 있다.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final int DEFAULT_PAGE_SIZE = RivalAlertService.DEFAULT_PAGE_SIZE;
    public static final int MAX_PAGE_SIZE = RivalAlertService.MAX_PAGE_SIZE;

    private final RivalAlertService rivalAlertService;
    private final TierAlertService tierAlertService;
    private final NotificationMapper notificationMapper;
    private final RivalNotificationRepository rivalNotificationRepository;
    private final TierNotificationRepository tierNotificationRepository;

    @Transactional
    public long unreadCount(Long userId, NoteOption noteOption, RatingCalculator calculator) {
        rivalAlertService.refresh(userId, noteOption);
        tierAlertService.deliver(userId, noteOption, calculator);
        return rivalNotificationRepository.countByRecipient_IdAndStatusAndReadAtIsNull(userId, RivalNotificationStatus.SHOWN)
                + tierAlertService.unreadCount(userId);
    }

    /**
     * 섞은 목록의 한 쪽. 순서는 NotificationMapper가 (종류, id)로 정하고, 내용은 종류별 저장소에서 한 번씩 읽어(N+1 없음) 그 순서대로 붙인다.
     */
    @Transactional
    public PageResponse<NotificationResponse> list(Long userId, NoteOption noteOption, RatingCalculator calculator,
                                                   int page, int size) {
        rivalAlertService.refresh(userId, noteOption);
        tierAlertService.deliver(userId, noteOption, calculator);

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        long total = notificationMapper.countAll(userId);
        List<NotificationKey> keys = notificationMapper.findPage(userId, safeSize, (long) safePage * safeSize);

        List<Long> rivalIds = idsOf(keys, "RIVAL");
        List<Long> tierIds = idsOf(keys, "TIER");
        Map<Long, RivalNotification> rivals = rivalIds.isEmpty() ? Map.of()
                : rivalNotificationRepository.findByRecipient_IdAndStatusAndIdIn(userId, RivalNotificationStatus.SHOWN, rivalIds)
                        .stream().collect(Collectors.toMap(RivalNotification::getId, Function.identity()));
        Map<Long, TierNotification> tiers = tierIds.isEmpty() ? Map.of()
                : tierNotificationRepository.findByUser_IdAndIdIn(userId, tierIds)
                        .stream().collect(Collectors.toMap(TierNotification::getId, Function.identity()));

        List<NotificationResponse> content = keys.stream()
                .map(k -> "RIVAL".equals(k.kind())
                        ? toResponse(rivals.get(k.id()))
                        : toResponse(tiers.get(k.id()), calculator))
                .filter(Objects::nonNull)
                .toList();
        int totalPages = (int) ((total + safeSize - 1) / safeSize);
        return new PageResponse<>(content, safePage, safeSize, total, totalPages);
    }

    /** 모두 읽음: 두 종류 모두. */
    @Transactional
    public void markAllRead(Long userId) {
        rivalAlertService.markAllRead(userId);
        tierAlertService.markAllRead(userId);
    }

    private static List<Long> idsOf(List<NotificationKey> keys, String kind) {
        return keys.stream().filter(k -> kind.equals(k.kind())).map(NotificationKey::id).toList();
    }

    private static NotificationResponse toResponse(RivalNotification n) {
        return n == null ? null : NotificationResponse.from(n);
    }

    private static NotificationResponse toResponse(TierNotification n, RatingCalculator calculator) {
        return n == null ? null : NotificationResponse.from(n, calculator);
    }
}
