package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.UserListItem;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 내 리스트의 곡 한 줄. tier는 SRN+ 서열표의 기준 난이도(서열표에 없거나 미정이면 null), pattern은 서열표의 속성 글자(없으면 null),
 * mine은 내 SRN+ 최고 기록(없으면 null, 달성률·단계는 저장하지 않고 내 기록에서 계산한 값). 세트리스트 한 줄과 같은 모양이다.
 */
public record UserListItemResponse(Long id, Long songDifficultyId, Long songId, String title, InstrumentPart part,
                                   DifficultyType difficulty, BigDecimal level, BigDecimal tier, String pattern,
                                   MyRecord mine, Instant createdAt) {

    public static UserListItemResponse of(UserListItem item, BigDecimal tier, String pattern, MyRecord mine) {
        SongDifficulty d = item.getSongDifficulty();
        return new UserListItemResponse(item.getId(), d.getId(), d.getSong().getId(), d.getSong().getTitle(),
                d.getInstrumentPart(), d.getDifficultyType(), d.getLevel(), tier, pattern, mine, item.getCreatedAt());
    }
}
