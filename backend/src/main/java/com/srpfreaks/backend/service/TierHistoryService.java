package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TierHistoryResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.mapper.TierHistoryMapper;
import com.srpfreaks.backend.mapper.TierHistoryRow;
import com.srpfreaks.backend.repository.SongRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZoneOffset;
import java.util.List;

/** 곡 상세의 서열표 변경 이력(기준 난이도·속성). 로그인 없이 읽을 수 있고, 변경한 사람은 알려 주지 않는다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TierHistoryService {

    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 50;

    private final SongRepository songRepository;
    private final TierHistoryMapper mapper;

    public PageResponse<TierHistoryResponse> history(Long songId, int page, int size) {
        songRepository.findByIdAndDeletedFalse(songId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        int safePage = Math.max(page, 0);
        // 한 번에 큰 목록을 요청해 서버를 느리게 만드는 것을 막는다
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);

        long total = mapper.countBySong(songId);
        List<TierHistoryResponse> content = mapper.findBySong(songId, safeSize, (long) safePage * safeSize).stream()
                .map(TierHistoryService::toResponse)
                .toList();
        int totalPages = (int) ((total + safeSize - 1) / safeSize);
        return new PageResponse<>(content, safePage, safeSize, total, totalPages);
    }

    private static TierHistoryResponse toResponse(TierHistoryRow row) {
        return new TierHistoryResponse(
                row.changedAt().toInstant(ZoneOffset.UTC),
                "TABLE_ENTRY_CREATE".equals(row.action()),
                row.songDifficultyId(),
                InstrumentPart.valueOf(row.part()),
                DifficultyType.valueOf(row.difficulty()),
                row.level(),
                decimal(row.beforeTier()),
                decimal(row.afterTier()),
                row.beforePattern(),
                row.afterPattern());
    }

    private static BigDecimal decimal(String value) {
        return value == null ? null : new BigDecimal(value);
    }
}
