package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.TierHistoryResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.mapper.TierHistoryMapper;
import com.srpfreaks.backend.mapper.TierHistoryRow;
import com.srpfreaks.backend.repository.SongRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TierHistoryServiceTest {

    @Mock SongRepository songRepository;
    @Mock TierHistoryMapper mapper;
    @InjectMocks TierHistoryService service;

    private void songExists() {
        when(songRepository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(Song.create("곡", null, "test", null)));
    }

    @Test
    void 곡이_없으면_NOT_FOUND이고_이력을_읽지_않는다() {
        when(songRepository.findByIdAndDeletedFalse(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.history(9L, 0, 10)).isInstanceOf(ApiException.class);
        verifyNoInteractions(mapper);
    }

    @Test
    void 줄을_응답으로_바꾼다_시각은_UTC로_읽고_숫자는_BigDecimal이다() {
        songExists();
        when(mapper.countBySong(1L)).thenReturn(2L);
        when(mapper.findBySong(1L, 10, 0)).thenReturn(List.of(
                new TierHistoryRow("TABLE_ENTRY_UPDATE", LocalDateTime.of(2026, 10, 22, 6, 0), 7L, "BASS", "MASTER",
                        new BigDecimal("9.00"), "9.0", null, "단일", "복합"),
                new TierHistoryRow("TABLE_ENTRY_CREATE", LocalDateTime.of(2026, 10, 1, 0, 0), 7L, "BASS", "MASTER",
                        new BigDecimal("9.00"), null, "9.0", null, "단일")));

        PageResponse<TierHistoryResponse> result = service.history(1L, 0, 10);

        assertThat(result.totalElements()).isEqualTo(2);
        assertThat(result.totalPages()).isEqualTo(1);
        TierHistoryResponse update = result.content().get(0);
        assertThat(update.changedAt()).isEqualTo(Instant.parse("2026-10-22T06:00:00Z"));
        assertThat(update.created()).isFalse();
        assertThat(update.part()).isEqualTo(InstrumentPart.BASS);
        assertThat(update.difficulty()).isEqualTo(DifficultyType.MASTER);
        assertThat(update.beforeTier()).isEqualByComparingTo("9.0");
        assertThat(update.afterTier()).isNull();
        assertThat(update.beforePattern()).isEqualTo("단일");
        assertThat(update.afterPattern()).isEqualTo("복합");
        TierHistoryResponse created = result.content().get(1);
        assertThat(created.created()).isTrue();
        assertThat(created.beforeTier()).isNull();
    }

    @Test
    void 페이지_크기는_1에서_50_사이로_맞추고_음수_페이지는_0이다() {
        songExists();
        when(mapper.countBySong(1L)).thenReturn(120L);
        when(mapper.findBySong(anyLong(), anyInt(), anyLong())).thenReturn(List.of());

        PageResponse<TierHistoryResponse> big = service.history(1L, -3, 100000);

        verify(mapper).findBySong(1L, 50, 0L);
        assertThat(big.size()).isEqualTo(50);
        assertThat(big.page()).isZero();
        assertThat(big.totalPages()).isEqualTo(3);

        service.history(1L, 2, 0);
        verify(mapper).findBySong(1L, 1, 2L);
    }
}
