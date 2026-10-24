package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.SetlistItem;
import com.srpfreaks.backend.entity.SongDifficulty;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 세트리스트 한 줄. tier는 SRN+ 서열표의 기준 난이도(서열표에 없거나 미정이면 null), pattern은 서열표의 속성 글자(단일/복합/이중/삼중/레이팅 제외, 없으면 null), mine은 내 SRN+ 최고 기록(없으면 null),
 * done은 담은 뒤에 그 채보 기록을 저장·수정했는지(저장하지 않고 계산한 값)다.
 */
public record SetlistItemResponse(Long id, Long songDifficultyId, Long songId, String title, InstrumentPart part,
                                  DifficultyType difficulty, BigDecimal level, BigDecimal tier, String pattern,
                                  MyRecord mine, boolean done, Instant createdAt) {

    public static SetlistItemResponse of(SetlistItem item, BigDecimal tier, String pattern, MyRecord mine, boolean done) {
        SongDifficulty d = item.getSongDifficulty();
        return new SetlistItemResponse(item.getId(), d.getId(), d.getSong().getId(), d.getSong().getTitle(),
                d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(), tier, pattern, mine, done, item.getCreatedAt());
    }
}
