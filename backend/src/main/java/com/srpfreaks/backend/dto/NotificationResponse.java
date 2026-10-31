package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.SongDifficulty;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 라이벌 역전 알림 한 줄(D56). 닉네임·곡명은 저장된 글자가 아니라 지금의 값이다.
 * bundled면 songCount곡을 묶은 줄이고, 곡 정보는 묶음의 첫 곡이다. myRate = 받는 사람(나)의 기록.
 */
public record NotificationResponse(Long id, Long actorUserId, String actorNickname, Long songId, Long songDifficultyId,
                                   String title, InstrumentPart part, DifficultyType difficulty, BigDecimal level,
                                   BigDecimal actorRate, BigDecimal myRate, boolean bundled, int songCount,
                                   Instant visibleAt, boolean read) {

    public static NotificationResponse from(RivalNotification n) {
        SongDifficulty d = n.getSongDifficulty();
        return new NotificationResponse(n.getId(), n.getActor().getId(), n.getActor().getNickname(), d.getSong().getId(),
                d.getId(), d.getSong().getTitle(), d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(),
                n.getActorRate(), n.getRecipientRate(), n.isBundled(), n.getSongCount(), n.getVisibleAt(), n.getReadAt() != null);
    }
}
