package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 레이팅 목록 비교 결과 (D32 확장). 이전(from)과 이후(to)의 레이팅 목록(단일 15 + 그 외 25)을 채보 단위로 견준다.
 *  - entered: 이후에만 있는 곡(새로 들어옴, 화면에 NEW 표시) / left: 이전에만 있는 곡(밀려남)
 *  - improved / declined: 양쪽에 있고 달성률이 오른/내린 곡 (같은 달성률은 담지 않는다)
 * available=false면 비교할 수 없는 이유(reason)만 담긴다: NO_PREVIOUS(이전 스냅샷 없음), NO_DETAIL(상세가 없는 예전 스냅샷), NO_SNAPSHOT.
 * toDate가 null이면 "지금(계산한 현재 레이팅)"과 비교한 것이다.
 */
public record SnapshotCompareResponse(boolean available, String reason, LocalDate fromDate, LocalDate toDate,
                                      BigDecimal fromTotal, BigDecimal toTotal, BigDecimal totalChange,
                                      List<Change> entered, List<Change> improved, List<Change> declined, List<Change> left) {

    /** 비교한 채보 한 줄. 없는 쪽(entered의 이전, left의 이후)은 null이다. */
    public record Change(Long songDifficultyId, Long songId, String title, InstrumentPart part, DifficultyType difficulty,
                         String group, BigDecimal rateBefore, BigDecimal rateAfter,
                         BigDecimal scoreBefore, BigDecimal scoreAfter) {
    }

    public static SnapshotCompareResponse unavailable(String reason) {
        return new SnapshotCompareResponse(false, reason, null, null, null, null, null, List.of(), List.of(), List.of(), List.of());
    }
}
