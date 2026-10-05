package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 곡 검색: 정렬 화이트리스트, 페이지 크기 상한, 키워드 이스케이프, 삭제된 곡 숨김. */
@ExtendWith(MockitoExtension.class)
class SongQueryServiceTest {

    @Mock SongRepository songRepository;
    @Mock SongTitleRepository songTitleRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;

    SongQueryService service;

    @BeforeEach
    void setUp() {
        service = new SongQueryService(songRepository, songTitleRepository, songDifficultyRepository);
    }

    private Page<Song> emptyPage() {
        return new PageImpl<>(List.of());
    }

    private Pageable capturePageable() {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(songRepository).findByDeletedFalse(captor.capture());
        return captor.getValue();
    }

    @Test
    void 키워드가_없으면_삭제되지_않은_곡_전체를_곡명순으로_조회한다() {
        when(songRepository.findByDeletedFalse(any())).thenReturn(emptyPage());

        service.search(null, 0, 20, null);

        Pageable pageable = capturePageable();
        assertThat(pageable.getSort().getOrderFor("title")).isNotNull();
        assertThat(pageable.getSort().getOrderFor("title").getDirection()).isEqualTo(Sort.Direction.ASC);
    }

    @Test
    void 페이지_크기는_50으로_제한하고_음수_페이지는_0으로_고친다() {
        when(songRepository.findByDeletedFalse(any())).thenReturn(emptyPage());

        service.search("  ", -3, 10_000, "recent");

        Pageable pageable = capturePageable();
        assertThat(pageable.getPageSize()).isEqualTo(50);
        assertThat(pageable.getPageNumber()).isZero();
    }

    @Test
    void 허용하지_않은_정렬_값은_거부한다() {
        assertThatThrownBy(() -> service.search(null, 0, 20, "password"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));
    }

    @Test
    void 너무_긴_키워드는_거부한다() {
        assertThatThrownBy(() -> service.search("a".repeat(101), 0, 20, null)).isInstanceOf(ApiException.class);
    }

    @Test
    void 키워드는_정규화한_패턴과_함께_검색한다() {
        when(songRepository.search(any(), any(), any())).thenReturn(emptyPage());

        service.search("Ｎecro Fantasia", 0, 20, null);

        // 곡명/아티스트는 입력 그대로, 표기(별칭)는 NFKC 정규화·공백 제거·소문자 값으로 찾는다
        verify(songRepository).search(eq("%Ｎecro Fantasia%"), eq("%necrofantasia%"), any());
    }

    @Test
    void LIKE_특수문자는_문자_그대로_찾도록_이스케이프한다() {
        assertThat(SongQueryService.likePattern("100%_!")).isEqualTo("%100!%!_!!%");
    }

    @Test
    void 삭제되었거나_없는_곡_상세는_404다() {
        when(songRepository.findByIdAndDeletedFalse(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail(9L))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }
}
