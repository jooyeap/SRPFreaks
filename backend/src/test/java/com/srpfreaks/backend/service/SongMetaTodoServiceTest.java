package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SongMetaTodoResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.mapper.SongMetaTodoMapper;
import com.srpfreaks.backend.mapper.SongMetaTodoRow;
import com.srpfreaks.backend.mapper.SongMetaTodoSummaryRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 곡 정보 정리(D91) 서비스: 필터·정렬 화이트리스트, 검색어 이스케이프, 페이지 보정, 요약 건수. */
@ExtendWith(MockitoExtension.class)
class SongMetaTodoServiceTest {

    @Mock SongMetaTodoMapper mapper;
    SongMetaTodoService service;

    @BeforeEach
    void setUp() {
        service = new SongMetaTodoService(mapper);
    }

    @Test
    void 요약의_전체_미등록은_아티스트_키워드_둘다로_중복없이_계산한다() {
        // 직접 계산: 37 + 112 - 21 = 128 (시안의 숫자)
        when(mapper.summary()).thenReturn(new SongMetaTodoSummaryRow(519, 37, 112, 21, 64));
        when(mapper.count("ANY", null)).thenReturn(0L);

        SongMetaTodoResponse.Summary summary = service.list(null, null, null, 0, 20).summary();

        assertThat(summary.totalSongs()).isEqualTo(519);
        assertThat(summary.anyMissing()).isEqualTo(128);
        assertThat(summary.noBpm()).isEqualTo(64); // BPM 없음은 전체 미등록(128)에 섞지 않고 따로 센다
    }

    @Test
    void 기본값은_전체_미등록_제목순_20개이고_행을_변환한다() {
        when(mapper.summary()).thenReturn(new SongMetaTodoSummaryRow(3, 1, 0, 0, 0));
        when(mapper.count("ANY", null)).thenReturn(41L);
        when(mapper.findPage("ANY", null, "title", 20, 0L)).thenReturn(List.of(
                new SongMetaTodoRow(5L, "Peyotl", null, 165, 172, 0, "GUITAR", "MASTER", new BigDecimal("9.65")),
                new SongMetaTodoRow(6L, "빈 곡", null, null, null, 0, null, null, null)));

        SongMetaTodoResponse response = service.list(null, "  ", null, 0, 20);

        assertThat(response.page().totalElements()).isEqualTo(41);
        assertThat(response.page().totalPages()).isEqualTo(3);
        assertThat(response.page().content().get(0).topPart()).isEqualTo(InstrumentPart.GUITAR);
        assertThat(response.page().content().get(0).topDifficulty()).isEqualTo(DifficultyType.MASTER);
        assertThat(response.page().content().get(1).topPart()).isNull();
        assertThat(response.page().content().get(0).bpmMin()).isEqualTo(165);
        assertThat(response.page().content().get(0).bpmMax()).isEqualTo(172);
        assertThat(response.page().content().get(1).bpmMin()).isNull();
    }

    @Test
    void 필터는_대소문자_구분_없이_받고_허용_밖_값은_400이다() {
        when(mapper.summary()).thenReturn(new SongMetaTodoSummaryRow(0, 0, 0, 0, 0));
        when(mapper.count("BOTH", null)).thenReturn(0L);

        assertThat(service.list("both", null, null, 0, 20).page().content()).isEmpty();
        assertThatThrownBy(() -> service.list("ALL; DROP TABLE songs", null, null, 0, 20))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
        verify(mapper, never()).findPage(eq("ALL; DROP TABLE songs"), isNull(), eq("title"), anyInt(), anyLong());
    }

    @Test
    void 정렬은_title_level만_받는다() {
        assertThatThrownBy(() -> service.list("ANY", null, "title desc, 1", 0, 20))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
    }

    @Test
    void 검색어의_와일드카드는_이스케이프하고_너무_길면_400이다() {
        assertThat(SongMetaTodoService.likePattern("100%_!")).isEqualTo("%100!%!_!!%");
        assertThat(SongMetaTodoService.likePattern(" ")).isNull();
        assertThatThrownBy(() -> SongMetaTodoService.likePattern("a".repeat(SongMetaTodoService.MAX_QUERY_LENGTH + 1)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void 페이지와_크기는_허용_범위로_맞춘다() {
        when(mapper.summary()).thenReturn(new SongMetaTodoSummaryRow(0, 0, 0, 0, 0));
        when(mapper.count("ANY", null)).thenReturn(1L);
        when(mapper.findPage("ANY", null, "title", SongMetaTodoService.MAX_PAGE_SIZE, 0L)).thenReturn(List.of());

        SongMetaTodoResponse response = service.list("ANY", null, "title", -3, 100000);

        assertThat(response.page().page()).isZero();
        assertThat(response.page().size()).isEqualTo(SongMetaTodoService.MAX_PAGE_SIZE);
    }

    @Test
    void 결과가_없으면_목록_쿼리를_부르지_않는다() {
        when(mapper.summary()).thenReturn(new SongMetaTodoSummaryRow(1, 0, 0, 0, 0));
        when(mapper.count("ANY", "%zzz%")).thenReturn(0L);

        assertThat(service.list("ANY", "zzz", null, 0, 20).page().content()).isEmpty();
        verify(mapper, never()).findPage(eq("ANY"), eq("%zzz%"), eq("title"), anyInt(), anyLong());
    }

    @Test
    void BPM_필터는_대소문자_구분_없이_받고_그대로_쿼리에_넘긴다() {
        when(mapper.summary()).thenReturn(new SongMetaTodoSummaryRow(10, 0, 0, 0, 4));
        when(mapper.count("BPM", "%a%")).thenReturn(4L);
        when(mapper.findPage("BPM", "%a%", "title", 20, 0L)).thenReturn(List.of(
                new SongMetaTodoRow(9L, "Aa", "x", null, null, 1, null, null, null)));

        SongMetaTodoResponse response = service.list("bpm", "a", null, 0, 20);

        assertThat(response.page().totalElements()).isEqualTo(4);
        assertThat(response.page().content()).hasSize(1);
        assertThat(response.summary().noBpm()).isEqualTo(4);
    }
}
