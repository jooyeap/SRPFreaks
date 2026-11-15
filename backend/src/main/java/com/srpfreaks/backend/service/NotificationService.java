package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.NotificationResponse;
import com.srpfreaks.backend.dto.RivalBundleSongResponse;
import com.srpfreaks.backend.dto.RivalBundleSongsResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.RivalNotificationStatus;
import com.srpfreaks.backend.entity.TierNotification;
import com.srpfreaks.backend.mapper.NotificationKey;
import com.srpfreaks.backend.mapper.RivalBundleCountRow;
import com.srpfreaks.backend.mapper.RivalBundleSummaryRow;
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

        Map<Long, RivalBundleInfo> bundleInfo = bundleInfo(userId, rivals.values());

        List<NotificationResponse> content = keys.stream()
                .map(k -> "RIVAL".equals(k.kind())
                        ? toResponse(rivals.get(k.id()), bundleInfo)
                        : toResponse(tiers.get(k.id()), calculator))
                .filter(Objects::nonNull)
                .toList();
        int totalPages = (int) ((total + safeSize - 1) / safeSize);
        return new PageResponse<>(content, safePage, safeSize, total, totalPages);
    }

    /**
     * 라이벌 묶음 알림의 곡 목록(D86). 본인의 묶음 줄(bundled)만 읽고, 남의 알림·없는 알림·묶음이 아닌 줄은 모두 404다.
     * 곡 = 묶음 줄 자신의 곡 + 같은 (받는 사람, 역전한 사람, 보인 날)의 BUNDLED 줄. 달성률은 줄에 저장된 값이다.
     */
    @Transactional(readOnly = true)
    public RivalBundleSongsResponse rivalBundleSongs(Long userId, Long notificationId, int page, int size) {
        RivalNotification bundle = rivalNotificationRepository
                .findByIdAndRecipient_IdAndStatus(notificationId, userId, RivalNotificationStatus.SHOWN)
                .filter(RivalNotification::isBundled)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Long actorId = bundle.getActor().getId();
        long total = notificationMapper.countBundleSongs(userId, actorId, bundle.getAlertDate(), bundle.getId());
        List<RivalBundleSongResponse> content = notificationMapper.findBundleSongs(userId, actorId, bundle.getAlertDate(),
                        bundle.getId(), safeSize, (long) safePage * safeSize).stream()
                .map(RivalBundleSongResponse::from).toList();
        long members = notificationMapper.findBundleMemberCounts(userId, List.of(bundle.getId())).stream()
                .mapToLong(RivalBundleCountRow::memberCount).sum();
        int totalPages = (int) ((total + safeSize - 1) / safeSize);
        return new RivalBundleSongsResponse(actorId, bundle.getActor().getNickname(), bundle.getSongCount(),
                missingCount(bundle.getSongCount(), members), new PageResponse<>(content, safePage, safeSize, total, totalPages));
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

    private record RivalBundleInfo(List<String> previewTitles, int missingCount) {
    }

    /**
     * 목록 한 쪽에 든 라이벌 묶음 줄의 곡명 미리보기와 "목록이 없는 곡 수"(D86). 묶음 줄이 없으면 쿼리를 하지 않고,
     * 있으면 쪽 전체에서 쿼리 2번(미리보기, 남은 줄 수)이다(줄마다 따로 읽으면 N+1).
     */
    private Map<Long, RivalBundleInfo> bundleInfo(Long userId, java.util.Collection<RivalNotification> rivals) {
        List<RivalNotification> bundles = rivals.stream().filter(RivalNotification::isBundled).toList();
        if (bundles.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = bundles.stream().map(RivalNotification::getId).toList();
        Map<Long, List<String>> previews = notificationMapper.findBundlePreviews(userId, ids).stream()
                .collect(Collectors.groupingBy(RivalBundleSummaryRow::bundleId,
                        Collectors.mapping(RivalBundleSummaryRow::title, Collectors.toList())));
        Map<Long, Long> members = notificationMapper.findBundleMemberCounts(userId, ids).stream()
                .collect(Collectors.toMap(RivalBundleCountRow::bundleId, RivalBundleCountRow::memberCount));
        Map<Long, RivalBundleInfo> result = new java.util.HashMap<>();
        for (RivalNotification b : bundles) {
            List<String> titles = new java.util.ArrayList<>();
            titles.add(b.getSongDifficulty().getSong().getTitle());   // 묶음 줄 자신의 곡이 첫 곡
            titles.addAll(previews.getOrDefault(b.getId(), List.of()));
            result.put(b.getId(), new RivalBundleInfo(titles, missingCount(b.getSongCount(), members.getOrDefault(b.getId(), 0L))));
        }
        return result;
    }

    /** 묶음이 센 곡 수 − (묶음 줄 자신 1 + 남아 있는 BUNDLED 줄 수). 줄을 지우던 때의 묶음이면 양수가 된다. */
    static int missingCount(int songCount, long memberCount) {
        return (int) Math.max(0, songCount - 1 - memberCount);
    }

    private static NotificationResponse toResponse(RivalNotification n, Map<Long, RivalBundleInfo> bundleInfo) {
        if (n == null) {
            return null;
        }
        NotificationResponse base = NotificationResponse.from(n);
        RivalBundleInfo info = bundleInfo.get(n.getId());
        return info == null ? base : base.withBundleInfo(info.previewTitles(), info.missingCount());
    }

    private static NotificationResponse toResponse(TierNotification n, RatingCalculator calculator) {
        return n == null ? null : NotificationResponse.from(n, calculator);
    }
}
