package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TierChangeResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.mapper.TierChangeMapper;
import com.srpfreaks.backend.mapper.TierChangeRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZoneOffset;
import java.util.List;

/**
 * 사이트 전체의 서열표 변경 목록(D58). 공지 화면의 `서열표 변경` 탭이 읽는다. 로그인 없이 읽을 수 있고,
 * 변경한 사람은 알려 주지 않는다. 운영자가 서열표 변경 공지를 직접 쓰지 않도록 변경 기록을 그대로 보여 준다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TierChangeService {

    public static final int DEFAULT_PAGE_SIZE = 30;
    public static final int MAX_PAGE_SIZE = 100;

    private final TierChangeMapper mapper;

    public PageResponse<TierChangeResponse> changes(int page, int size) {
        int safePage = Math.max(page, 0);
        // 한 번에 큰 목록을 요청해 서버를 느리게 만드는 것을 막는다
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);

        long total = mapper.countAll();
        List<TierChangeResponse> content = mapper.findAll(safeSize, (long) safePage * safeSize).stream()
                .map(TierChangeService::toResponse)
                .toList();
        int totalPages = (int) ((total + safeSize - 1) / safeSize);
        return new PageResponse<>(content, safePage, safeSize, total, totalPages);
    }

    private static TierChangeResponse toResponse(TierChangeRow row) {
        return new TierChangeResponse(
                row.changedAt().toInstant(ZoneOffset.UTC),
                "TABLE_ENTRY_CREATE".equals(row.action()),
                row.songId(),
                row.title(),
                row.songDifficultyId(),
                InstrumentPart.valueOf(row.part()),
                DifficultyType.valueOf(row.difficulty()),
                row.level(),
                decimal(row.beforeTier()),
                decimal(row.afterTier()),
                row.beforePattern(),
                row.afterPattern(),
                row.beforeRecommend(),
                row.afterRecommend());
    }

    private static BigDecimal decimal(String value) {
        return value == null ? null : new BigDecimal(value);
    }
}
