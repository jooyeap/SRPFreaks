package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.SongDifficulty;

import java.math.BigDecimal;

/** 서열표의 한 줄. recommend/pattern은 시트와 같은 한글 값(상/중/하, 단일/복합/...)으로 내린다. */
public record TableEntryResponse(Long entryId, Long songDifficultyId, Long songId, String title, String addedVersion,
                                 InstrumentPart part, DifficultyType difficulty, BigDecimal level,
                                 boolean tierUncertain, String recommend, boolean recommendUncertain,
                                 String pattern, boolean patternUncertain, MyRecord mine) {

    /** 내 최고 기록. 기록이 없으면 mine 자체가 null. 기록이 있으면 stage는 항상 있다(C 이상, D24). */
    public record MyRecord(BigDecimal rate, boolean fullCombo, AchievementStage stage) {
    }

    public static TableEntryResponse of(DifficultyTableEntry e, MyRecord mine) {
        SongDifficulty d = e.getSongDifficulty();
        return new TableEntryResponse(e.getId(), d.getId(), d.getSong().getId(), d.getSong().getTitle(),
                d.getSong().getAddedVersion(), d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(),
                e.isTierUncertain(),
                e.getRecommend() == null ? null : e.getRecommend().getLabel(), e.isRecommendUncertain(),
                e.getPatternType() == null ? null : e.getPatternType().getLabel(), e.isPatternUncertain(), mine);
    }
}
