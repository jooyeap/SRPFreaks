package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.Platform;
import com.srpfreaks.backend.entity.SongDifficulty;

import java.math.BigDecimal;
import java.time.Instant;

/** 기록 한 건. 곡 정보를 같이 담아 목록 화면이 추가 호출 없이 그려지게 한다. stage는 저장하지 않고 계산한 값.
 * playedAt은 사용자가 입력하는 플레이 시각이고, createdAt/updatedAt은 서버가 기록한 등록·마지막 수정 시각이다(화면에서 "등록/수정됨" 표시에 쓴다). */
public record RecordResponse(Long id, Long songDifficultyId, Long songId, String title, InstrumentPart part,
                             DifficultyType difficulty, BigDecimal level, NoteOption noteOption,
                             BigDecimal achievementRate, boolean fullCombo, AchievementStage stage,
                             Instant playedAt, Platform platform, String memo,
                             Instant createdAt, Instant updatedAt) {

    public static RecordResponse from(OptionRecord r) {
        SongDifficulty d = r.getSongDifficulty();
        return new RecordResponse(r.getId(), d.getId(), d.getSong().getId(), d.getSong().getTitle(),
                d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(), r.getNoteOption(),
                r.getAchievementRate(), r.isFullCombo(),
                AchievementStage.of(r.getAchievementRate(), r.isFullCombo()),
                r.getPlayedAt(), r.getPlatform(), r.getMemo(), r.getCreatedAt(), r.getUpdatedAt());
    }
}
