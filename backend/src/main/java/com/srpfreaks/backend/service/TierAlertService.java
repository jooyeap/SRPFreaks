package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.TierNotification;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.TierAlertMapper;
import com.srpfreaks.backend.mapper.TierAlertRow;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.TierNotificationRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 서열표 변경 알림(D61, 설계 DESIGN.md 18.2.2).
 *
 * 내가 기록한 채보의 기준 난이도가 바뀌어 "그 채보의 내 점수(V×20)"가 달라졌을 때만 알린다.
 * 속성·추천만 바뀐 변경은 점수가 그대로라 알리지 않는다(서열표 변경 탭 D58과 `최근 변경` 칩에만 보인다).
 *
 * 왜 스케줄러 없이 "읽을 때" 만드는가: 라이벌 알림(RivalAlertService)과 같은 이유다. 알림은 사용자가 사이트를 볼 때만 의미가 있고,
 * 읽는 순간의 최신 기록·설정으로 판단하면 주기 작업이 필요 없다. 사용자마다 커서(users.tier_notify_cursor = 마지막으로 본 감사 로그 번호)를
 * 두고, 그 뒤의 로그만 보고 커서를 끝으로 옮긴다. 그래서 같은 변경으로 알림이 두 번 생기지 않는다.
 *
 * 알려진 한계: 감사 로그 번호는 INSERT 순서로 매겨지고 커밋 순서와 다를 수 있다. 관리자 두 명이 동시에 고쳐 늦게 커밋된 작은 번호가
 * 이미 지나간 커서 뒤에 생기면 그 한 건은 알림에서 빠진다(서열표 변경 탭에는 그대로 보인다). 서열표 수정은 드물고 짧은 트랜잭션이라 받아들인다.
 */
@Service
@RequiredArgsConstructor
public class TierAlertService {

    private final TierAlertMapper mapper;
    private final TierNotificationRepository notificationRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final UserRepository userRepository;
    private final AppSettingRepository appSettingRepository;
    private final Clock clock;

    /**
     * 커서 뒤의 서열표 변경으로 알림을 만들고 커서를 옮긴다. 알림 개수·목록을 읽을 때 먼저 부른다.
     *
     * 1) 사용자 행을 잠근다(동시에 온 두 요청이 같은 알림을 두 번 만들지 않게, UserRepository.findByIdForUpdate 주석).
     * 2) 알림이 꺼져 있으면 아무것도 하지 않는다. 다시 켤 때 커서를 그 시점으로 옮기므로 꺼 둔 동안의 변경은 알리지 않는다.
     * 3) 커서가 비어 있으면(처음) 지금의 끝으로 채우고 끝낸다(과거 변경은 알리지 않는다).
     * 4) 같은 채보가 이번 확인 사이에 여러 번 바뀌었으면 "처음 전 값 → 마지막 후 값" 한 줄로 합치고, 그래서 점수가 달라진 채보만 남긴다.
     * 5) 남은 채보가 묶음 기준(tier.notify_bundle_over)을 넘으면 한 줄로 묶는다.
     */
    @Transactional
    public void deliver(Long userId, NoteOption noteOption, RatingCalculator calculator) {
        User user = userRepository.findByIdForUpdate(userId).orElse(null);
        if (user == null || !user.isTierNotify()) {
            return;
        }
        long end = mapper.maxAuditLogId();
        Long cursor = user.getTierNotifyCursor();
        if (cursor == null) {
            user.moveTierNotifyCursor(end);
            return;
        }
        if (end <= cursor) {
            return;   // 새 로그 없음(대부분의 읽기는 여기서 끝난다)
        }
        TierNotifyConfig config = TierNotifyConfig.load(appSettingRepository);
        Instant now = clock.instant();
        LocalDateTime since = LocalDateTime.ofInstant(now.minus(Duration.ofDays(config.keepDays())), ZoneOffset.UTC);
        List<TierAlertRow> rows = mapper.findChanges(userId, noteOption.name(), cursor, end, since);

        List<Change> changes = mergeByChart(rows).stream()
                .filter(c -> scoreChanged(calculator, c))
                .toList();
        save(user, changes, config, now);
        user.moveTierNotifyCursor(end);
        notificationRepository.deleteOlderThan(now.minus(Duration.ofDays(config.keepDays())));
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByUser_IdAndReadAtIsNull(userId);
    }

    @Transactional
    public void markRead(Long userId, Long notificationId) {
        // 남의 알림이면 없는 것과 같은 404
        notificationRepository.findByIdAndUser_Id(notificationId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND))
                .markRead(clock.instant());
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllRead(userId, clock.instant());
    }

    /** 한 채보의 이번 확인 구간 변경 요약. 전·후는 기준 난이도(null = 미정). */
    record Change(Long songDifficultyId, BigDecimal beforeTier, BigDecimal afterTier, BigDecimal myRate, Instant changedAt) {
    }

    /** 로그 번호 순의 줄을 채보별로 합친다: 전 = 첫 로그의 전, 후 = 마지막 로그의 후, 시각 = 마지막 로그의 시각. 처음 나온 채보 순서를 지킨다. */
    static List<Change> mergeByChart(List<TierAlertRow> rows) {
        Map<Long, Change> byChart = new LinkedHashMap<>();
        for (TierAlertRow row : rows) {
            Instant at = row.changedAt().toInstant(ZoneOffset.UTC);
            byChart.merge(row.songDifficultyId(),
                    new Change(row.songDifficultyId(), decimal(row.beforeTier()), decimal(row.afterTier()), row.myRate(), at),
                    (first, next) -> new Change(first.songDifficultyId(), first.beforeTier(), next.afterTier(), next.myRate(), next.changedAt()));
        }
        return new ArrayList<>(byChart.values());
    }

    /** 그 채보의 내 점수가 달라졌는가. 미정 ↔ 값은 "점수 없음 ↔ 있음"이라 달라진 것으로 본다. */
    static boolean scoreChanged(RatingCalculator calculator, Change c) {
        BigDecimal before = score(calculator, c.beforeTier(), c.myRate());
        BigDecimal after = score(calculator, c.afterTier(), c.myRate());
        if (before == null || after == null) {
            return !Objects.equals(before, after);
        }
        return before.compareTo(after) != 0;
    }

    /** 기준 난이도와 달성률로 계산한 채보 점수(V×20, 반올림 전). 미정이면 null. 레이팅 화면과 같은 RatingCalculator를 쓴다. */
    public static BigDecimal score(RatingCalculator calculator, BigDecimal tier, BigDecimal rate) {
        if (tier == null || rate == null) {
            return null;
        }
        return calculator.score(calculator.value(calculator.constant(tier), rate));
    }

    private void save(User user, List<Change> changes, TierNotifyConfig config, Instant now) {
        if (changes.isEmpty()) {
            return;
        }
        if (changes.size() > config.bundleOver()) {
            // 운영자가 한꺼번에 많이 고쳤을 때 알림 목록이 서열표 변경으로 뒤덮이지 않게 한 줄로 묶는다.
            // 묶음 줄의 시각은 가장 늦은 변경, 값은 첫 채보의 것(화면은 "곡명 외 N채보"로 보여 준다).
            Change first = changes.get(0);
            Instant latest = changes.stream().map(Change::changedAt).max(Instant::compareTo).orElse(first.changedAt());
            notificationRepository.save(TierNotification.bundle(user, songDifficultyRepository.getReferenceById(first.songDifficultyId()),
                    first.beforeTier(), first.afterTier(), first.myRate(), changes.size(), latest, now));
            return;
        }
        for (Change c : changes) {
            notificationRepository.save(TierNotification.single(user, songDifficultyRepository.getReferenceById(c.songDifficultyId()),
                    c.beforeTier(), c.afterTier(), c.myRate(), c.changedAt(), now));
        }
    }

    private static BigDecimal decimal(String value) {
        return value == null ? null : new BigDecimal(value);
    }
}
