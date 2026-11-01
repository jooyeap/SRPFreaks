package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TierChangeResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.mapper.TierChangeMapper;
import com.srpfreaks.backend.mapper.TierChangeRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TierChangeServiceTest {

    @Mock TierChangeMapper mapper;
    @InjectMocks TierChangeService service;

    @Test
    void 줄을_응답으로_바꾼다_시각은_UTC이고_추가는_created다() {
        when(mapper.countAll()).thenReturn(2L);
        when(mapper.findAll(30, 0)).thenReturn(List.of(
                new TierChangeRow("TABLE_ENTRY_UPDATE", LocalDateTime.of(2026, 11, 1, 6, 0), 3L, "곡", 7L, "BASS", "MASTER",
                        new BigDecimal("9.00"), "5.6", "5.7", "단일", "단일", "중", "상"),
                new TierChangeRow("TABLE_ENTRY_CREATE", LocalDateTime.of(2026, 10, 1, 0, 0), 3L, "곡", 7L, "BASS", "MASTER",
                        new BigDecimal("9.00"), null, "5.6", null, "단일", null, "중")));

        PageResponse<TierChangeResponse> page = service.changes(0, 30);

        assertThat(page.totalElements()).isEqualTo(2);
        TierChangeResponse first = page.content().get(0);
        assertThat(first.changedAt()).isEqualTo(Instant.parse("2026-11-01T06:00:00Z"));
        assertThat(first.created()).isFalse();
        assertThat(first.title()).isEqualTo("곡");
        assertThat(first.part()).isEqualTo(InstrumentPart.BASS);
        assertThat(first.difficulty()).isEqualTo(DifficultyType.MASTER);
        assertThat(first.beforeTier()).isEqualByComparingTo("5.6");
        assertThat(first.afterRecommend()).isEqualTo("상");
        assertThat(page.content().get(1).created()).isTrue();
        assertThat(page.content().get(1).beforeTier()).isNull();
    }

    @Test
    void 페이지_크기는_1에서_100으로_자르고_음수_페이지는_0이다() {
        when(mapper.countAll()).thenReturn(0L);
        service.changes(-3, 5000);
        verify(mapper).findAll(100, 0);
    }
}
