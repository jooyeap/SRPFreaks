package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.NotificationResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.RivalNotificationStatus;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RivalNotificationRepository;
import com.srpfreaks.backend.repository.RivalRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserBest;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 라이벌 역전 알림(D56, 설계 DESIGN.md 18.2.1).
 *
 * 두 단계로 나눈다:
 *  1) 판정(detect): A가 기록을 저장한 직후. "B가 이기고 있던 채보를 A가 넘었는가"만 보고 PENDING 줄을 만든다(보일 시각 = 지금 + 10분).
 *  2) 전달(deliverDue): B가 알림 개수·목록을 읽을 때. 보일 시각이 지난 PENDING을 다시 확인해서 보이거나(하루 3건까지 따로, 넘으면 묶음) 지운다.
 *
 * 왜 스케줄러를 두지 않는가: 알림은 B가 사이트를 볼 때만 의미가 있다. 읽을 때 처리하면 서버에 주기 작업이 없어도 되고,
 * "10분 뒤 다시 확인"도 읽는 순간의 최신 기록으로 하게 된다(그 사이 A가 기록을 고쳤으면 자연히 걸러진다).
 */
@Service
@RequiredArgsConstructor
public class RivalAlertService {

    /** 하루의 기준. 스냅샷·세트리스트 이력과 같이 사용자가 보는 서울 날짜. */
    static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;

    private final RivalRepository rivalRepository;
    private final RivalNotificationRepository notificationRepository;
    private final OptionRecordRepository optionRecordRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final UserRepository userRepository;
    private final AppSettingRepository appSettingRepository;
    private final Clock clock;

    /**
     * 판정. prev = 저장 직전 A의 그 채보 최고 달성률(없으면 첫 기록이라 알림 없음), next = 저장 뒤 최고 달성률.
     * 서로 라이벌 B마다 B 최고값 b가 있고 prev < b < next 이면 알림 후보다. 동점(prev == b)에서 이긴 것은 "지고 있던" 게 아니라서 뺀다.
     *
     * REQUIRES_NEW: 기록 저장과 따로 커밋한다. 알림 처리가 실패해도 기록 저장은 취소되면 안 된다(호출하는 RivalAlertTrigger가 예외를 삼킨다).
     * 저장 중인 A의 기록은 아직 커밋 전이라 이 트랜잭션에서 보이지 않으므로, prev·next는 호출한 쪽에서 계산해 넘긴다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void detect(Long actorId, Long songDifficultyId, NoteOption noteOption, BigDecimal prev, BigDecimal next) {
        if (prev == null || next == null || next.compareTo(prev) <= 0) {
            return;   // 첫 기록이거나 최고 기록이 오르지 않았다
        }
        User actor = userRepository.findById(actorId).orElse(null);
        if (actor == null || !isVisible(actor)) {
            return;
        }
        List<User> recipients = rivalRepository.findMutualTargets(actorId).stream()
                .filter(RivalAlertService::isVisible)
                .filter(User::isRivalNotify)
                .toList();
        if (recipients.isEmpty()) {
            return;
        }
        Map<Long, BigDecimal> bests = optionRecordRepository.findBestRatesForUsers(songDifficultyId, noteOption,
                        recipients.stream().map(User::getId).toList()).stream()
                .collect(Collectors.toMap(UserBest::userId, UserBest::bestRate));

        RivalConfig config = RivalConfig.load(appSettingRepository);
        Instant now = clock.instant();
        Instant visibleAt = now.plus(Duration.ofMinutes(config.notifyDelayMinutes()));
        for (User recipient : recipients) {
            BigDecimal theirs = bests.get(recipient.getId());
            if (theirs == null || prev.compareTo(theirs) >= 0 || next.compareTo(theirs) <= 0) {
                continue;   // 상대 기록 없음 / 원래 지고 있지 않았음(동점 포함) / 저장 뒤에도 못 넘음
            }
            notificationRepository.findFirstByRecipient_IdAndActor_IdAndSongDifficulty_IdAndStatus(
                            recipient.getId(), actorId, songDifficultyId, RivalNotificationStatus.PENDING)
                    .ifPresentOrElse(
                            pending -> pending.refreshPending(next, theirs, visibleAt),
                            () -> notificationRepository.save(RivalNotification.pending(recipient, actor,
                                    songDifficultyRepository.getReferenceById(songDifficultyId), next, theirs, visibleAt, now)));
        }
        notificationRepository.deleteOlderThan(now.minus(Duration.ofDays(config.notifyKeepDays())));
    }

    /** 안 읽은 알림 수. 읽기 전에 보일 시각이 지난 알림을 먼저 처리한다. */
    @Transactional
    public long unreadCount(Long recipientId, NoteOption noteOption) {
        deliverDue(recipientId, noteOption);
        return notificationRepository.countByRecipient_IdAndStatusAndReadAtIsNull(recipientId, RivalNotificationStatus.SHOWN);
    }

    @Transactional
    public PageResponse<NotificationResponse> list(Long recipientId, NoteOption noteOption, int page, int size) {
        refresh(recipientId, noteOption);
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "visibleAt").and(Sort.by(Sort.Direction.DESC, "id")));
        return PageResponse.of(notificationRepository.findByRecipient_IdAndStatus(recipientId, RivalNotificationStatus.SHOWN,
                pageable), NotificationResponse::from);
    }

    /**
     * 목록을 읽기 전 정리: 보일 시각이 지난 알림을 처리하고 보관 기간이 지난 알림을 지운다.
     * 서열표 변경 알림과 섞은 목록(NotificationService)도 읽기 전에 이것을 부른다.
     */
    @Transactional
    public void refresh(Long recipientId, NoteOption noteOption) {
        deliverDue(recipientId, noteOption);
        RivalConfig config = RivalConfig.load(appSettingRepository);
        notificationRepository.deleteOlderThan(clock.instant().minus(Duration.ofDays(config.notifyKeepDays())));
    }

    @Transactional
    public void markRead(Long recipientId, Long notificationId) {
        // 남의 알림이면 없는 것과 같은 404
        notificationRepository.findByIdAndRecipient_IdAndStatus(notificationId, recipientId, RivalNotificationStatus.SHOWN)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND))
                .markRead(clock.instant());
    }

    @Transactional
    public void markAllRead(Long recipientId) {
        notificationRepository.markAllRead(recipientId, clock.instant());
    }

    /**
     * 전달. 보일 시각이 지난 PENDING을 오래된 것부터 다시 확인한다.
     * 확인: 서로 라이벌이 그대로이고, 둘 다 공개 ACTIVE이고, 받는 사람이 알림을 켰고, 지금도 A 최고값 > B 최고값.
     * 통과하면 그날(서울 날짜) A에게서 따로 보인 알림이 하루 개수 미만이면 따로 보이고, 아니면 그날의 묶음 줄에 곡을 더한다.
     */
    void deliverDue(Long recipientId, NoteOption noteOption) {
        Instant now = clock.instant();
        List<RivalNotification> due = notificationRepository.findDue(recipientId, now);
        if (due.isEmpty()) {
            return;
        }
        User recipient = userRepository.findById(recipientId).orElse(null);
        Set<Long> mutual = recipient == null ? Set.of()
                : rivalRepository.findMutualTargets(recipientId).stream().map(User::getId).collect(Collectors.toSet());
        boolean recipientOk = recipient != null && isVisible(recipient) && recipient.isRivalNotify();
        RivalConfig config = RivalConfig.load(appSettingRepository);

        for (RivalNotification n : due) {
            User actor = n.getActor();
            Long chartId = n.getSongDifficulty().getId();
            BigDecimal actorBest = null;
            BigDecimal recipientBest = null;
            boolean ok = recipientOk && mutual.contains(actor.getId()) && isVisible(actor)
                    && songDifficultyRepository.findByIdAndDeletedFalse(chartId).filter(d -> !d.getSong().isDeleted()).isPresent();
            if (ok) {
                actorBest = optionRecordRepository.findBestRate(actor.getId(), chartId, noteOption);
                recipientBest = optionRecordRepository.findBestRate(recipientId, chartId, noteOption);
                ok = actorBest != null && recipientBest != null && actorBest.compareTo(recipientBest) > 0;
            }
            if (!ok) {
                notificationRepository.delete(n);   // 기록을 고쳐 역전이 아니게 됐거나 관계·공개·설정이 바뀌었다
                continue;
            }
            LocalDate day = LocalDate.ofInstant(n.getVisibleAt(), ZONE);
            long shownToday = notificationRepository.countByRecipient_IdAndActor_IdAndAlertDateAndBundledFalseAndStatus(
                    recipientId, actor.getId(), day, RivalNotificationStatus.SHOWN);
            if (shownToday < config.notifyDailyPerRival()) {
                n.show(actorBest, recipientBest, day);
                continue;
            }
            RivalNotification bundle = notificationRepository
                    .findFirstByRecipient_IdAndActor_IdAndAlertDateAndBundledTrue(recipientId, actor.getId(), day).orElse(null);
            if (bundle == null) {
                n.showAsBundle(actorBest, recipientBest, day);
            } else {
                bundle.addToBundle(n.getVisibleAt());
                notificationRepository.delete(n);
            }
            // 같은 반복 안에서 다음 줄이 방금 바꾼 상태(개수·묶음)를 보도록 바로 반영한다
            notificationRepository.flush();
        }
    }

    /** 공개한 ACTIVE 유저인가(닉네임이 있어야 공개할 수 있다). */
    static boolean isVisible(User user) {
        return user.getStatus() == UserStatus.ACTIVE && user.isProfilePublic() && user.getNickname() != null;
    }
}
