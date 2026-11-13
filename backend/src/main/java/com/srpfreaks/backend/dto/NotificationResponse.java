package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.TierNotification;
import com.srpfreaks.backend.service.RatingCalculator;
import com.srpfreaks.backend.service.TierAlertService;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 알림 한 줄. kind로 라이벌 역전 알림(D56)과 서열표 변경 알림(D61)을 구분한다. 종류마다 쓰지 않는 필드는 null이다.
 * 닉네임·곡명은 저장된 글자가 아니라 지금의 값이다. visibleAt은 목록 정렬·`n분 전` 표시에 쓰는 시각
 * (라이벌 = 보인 시각, 서열표 = 서열표가 바뀐 시각).
 *
 * - RIVAL: actorUserId·actorNickname·actorRate, myRate = 받는 사람(나)의 기록. bundled면 songCount곡을 묶은 줄이고 곡 정보는 묶음의 첫 곡이다.
 * - TIER : beforeTier·afterTier(null = 미정), myRate = 알림을 만든 때의 내 최고 달성률,
 *          beforeScore·afterScore = 그 달성률로 계산한 전·후 점수(둘째 자리, 미정이면 null), scoreDiff = 후 − 전(둘 다 있을 때만).
 *          bundled면 songCount채보를 묶은 줄이고 값은 첫 채보의 것이다.
 */
public record NotificationResponse(NotificationKind kind, Long id, Long actorUserId, String actorNickname, Long songId,
                                   Long songDifficultyId, String title, InstrumentPart part, DifficultyType difficulty,
                                   BigDecimal level, BigDecimal actorRate, BigDecimal myRate, boolean bundled, int songCount,
                                   Instant visibleAt, boolean read, BigDecimal beforeTier, BigDecimal afterTier,
                                   BigDecimal beforeScore, BigDecimal afterScore, BigDecimal scoreDiff) {

    public static NotificationResponse from(RivalNotification n) {
        SongDifficulty d = n.getSongDifficulty();
        return new NotificationResponse(NotificationKind.RIVAL, n.getId(), n.getActor().getId(), n.getActor().getNickname(),
                d.getSong().getId(), d.getId(), d.getSong().getTitle(), d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(),
                n.getActorRate(), n.getRecipientRate(), n.isBundled(), n.getSongCount(), n.getVisibleAt(), n.getReadAt() != null,
                null, null, null, null, null);
    }

    /** 점수는 저장하지 않으므로 지금의 레이팅 설정으로 계산한다(레이팅 화면과 같은 계산기). */
    public static NotificationResponse from(TierNotification n, RatingCalculator calculator) {
        SongDifficulty d = n.getSongDifficulty();
        BigDecimal before = display(TierAlertService.score(calculator, n.getBeforeTier(), n.getMyRate()));
        BigDecimal after = display(TierAlertService.score(calculator, n.getAfterTier(), n.getMyRate()));
        BigDecimal diff = before == null || after == null ? null : after.subtract(before);
        return new NotificationResponse(NotificationKind.TIER, n.getId(), null, null, d.getSong().getId(), d.getId(),
                d.getSong().getTitle(), d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(), null, n.getMyRate(),
                n.isBundled(), n.getSongCount(), n.getChangedAt(), n.getReadAt() != null,
                n.getBeforeTier(), n.getAfterTier(), before, after, diff);
    }

    private static BigDecimal display(BigDecimal exact) {
        return exact == null ? null : RatingCalculator.display(exact);
    }
}
