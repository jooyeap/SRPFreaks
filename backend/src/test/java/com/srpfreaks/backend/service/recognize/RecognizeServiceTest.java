package com.srpfreaks.backend.service.recognize;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.RecognizeResultResponse;
import com.srpfreaks.backend.dto.RecognizeStatusResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.RecognizeUsage;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.service.RecognizeAccessPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecognizeServiceTest {

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    private static final RecognizeStatusResponse OK = new RecognizeStatusResponse(true, null, 30, 30, null);

    @Mock RecognizeAccessPolicy accessPolicy;
    @Mock VisionClient visionClient;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock SongTitleRepository songTitleRepository;
    @Mock UserRepository userRepository;
    RecognizeService service;

    @BeforeEach
    void setUp() {
        service = new RecognizeService(accessPolicy, visionClient, songDifficultyRepository, songTitleRepository, userRepository,
                Clock.fixed(Instant.parse("2026-10-28T05:00:00Z"), ZoneOffset.UTC));
        lenient().when(visionClient.isConfigured()).thenReturn(true);
        lenient().when(songTitleRepository.findByNormalizedTitle(anyString())).thenReturn(List.of());
    }

    private static VisionResult read(String title, String part, String diff, String rate) {
        return new VisionResult(title, part, diff, "9.65", rate, 3, false, true);
    }

    private static SongDifficulty chart(long songId, String title, long chartId, InstrumentPart part, DifficultyType type) {
        Song song = Song.create(title, "Artist", "test", null);
        ReflectionTestUtils.setField(song, "id", songId);
        SongDifficulty d = SongDifficulty.create(song, part, type, new BigDecimal("9.65"));
        ReflectionTestUtils.setField(d, "id", chartId);
        return d;
    }

    @Test
    void 시험_기간에_USER면_403이고_사용량을_세지_않는다() {
        when(accessPolicy.status(1L, Role.USER)).thenReturn(new RecognizeStatusResponse(false, "ROLE", 0, 30, null));
        assertThatThrownBy(() -> service.recognize(1L, Role.USER, JPEG))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));
        verify(accessPolicy, never()).record(any());
    }

    @Test
    void 한도를_넘으면_429_꺼져_있으면_503() {
        when(accessPolicy.status(1L, Role.ADMIN)).thenReturn(new RecognizeStatusResponse(false, "WEEKLY_LIMIT", 0, 30, null));
        assertThatThrownBy(() -> service.recognize(1L, Role.ADMIN, JPEG))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.RECOGNIZE_LIMIT));
        when(accessPolicy.status(1L, Role.ADMIN)).thenReturn(new RecognizeStatusResponse(false, "DISABLED", 0, 30, null));
        assertThatThrownBy(() -> service.recognize(1L, Role.ADMIN, JPEG))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.RECOGNIZE_UNAVAILABLE));
    }

    @Test
    void 사진이_아니거나_키가_없으면_사용량을_세지_않고_멈춘다() {
        when(accessPolicy.status(1L, Role.ADMIN)).thenReturn(OK);
        assertThatThrownBy(() -> service.recognize(1L, Role.ADMIN, "not an image!!".getBytes()))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.RECOGNIZE_BAD_IMAGE));
        when(visionClient.isConfigured()).thenReturn(false);
        assertThatThrownBy(() -> service.recognize(1L, Role.ADMIN, JPEG))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.RECOGNIZE_UNAVAILABLE));
        verify(accessPolicy, never()).record(any());
        verify(visionClient, never()).read(any(), anyString());
    }

    @Test
    void 사용량을_먼저_세고_모델이_한_번_실패하면_한_번만_다시_부른다() {
        when(accessPolicy.status(1L, Role.ADMIN)).thenReturn(OK);
        when(visionClient.read(JPEG, "image/jpeg"))
                .thenThrow(new VisionClient.VisionException("x"))
                .thenReturn(read("Unknown Song", "GUITAR", "MASTER", "92.45"));
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(List.of());

        RecognizeResultResponse r = service.recognize(1L, Role.ADMIN, JPEG);
        verify(accessPolicy, times(1)).record(any(RecognizeUsage.class));
        verify(visionClient, times(2)).read(JPEG, "image/jpeg");
        assertThat(r.remaining()).isEqualTo(29);
        assertThat(r.candidates()).isEmpty();
        assertThat(r.songDifficultyId()).isNull();
    }

    @Test
    void 두_번_다_실패하면_503이고_사용량은_이미_센_그대로다() {
        when(accessPolicy.status(1L, Role.ADMIN)).thenReturn(OK);
        when(visionClient.read(JPEG, "image/jpeg")).thenThrow(new VisionClient.VisionException("x"));
        assertThatThrownBy(() -> service.recognize(1L, Role.ADMIN, JPEG))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.RECOGNIZE_UNAVAILABLE));
        verify(accessPolicy).record(any(RecognizeUsage.class));
    }

    @Test
    void 곡명이_정규화로_맞고_파트_난이도가_맞으면_채보를_정한다() {
        SongDifficulty master = chart(7, "Step Forward", 70, InstrumentPart.GUITAR, DifficultyType.MASTER);
        SongDifficulty extreme = chart(7, "Step Forward", 71, InstrumentPart.GUITAR, DifficultyType.EXTREME);
        SongDifficulty other = chart(8, "Golden Galaxy", 80, InstrumentPart.GUITAR, DifficultyType.MASTER);
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(List.of(master, extreme, other));

        RecognizeResultResponse r = service.toResponse(read("step  forward", "guitar", "master", "92.454"), 10);
        assertThat(r.songDifficultyId()).isEqualTo(70L);
        assertThat(r.candidates()).extracting(RecognizeResultResponse.SongCandidate::songId).containsExactly(7L);
        assertThat(r.part()).isEqualTo("GUITAR");
        assertThat(r.achievementRate()).isEqualByComparingTo("92.45");
        assertThat(r.level()).isEqualByComparingTo("9.65");
        assertThat(r.fullCombo()).isFalse();
        assertThat(r.superRandomPlus()).isTrue();
    }

    @Test
    void 달성률_경계와_풀콤보를_정한다() {
        when(songDifficultyRepository.findAllActiveWithSong()).thenReturn(List.of());
        assertThat(service.toResponse(read("a", null, null, "MAX"), 0).achievementRate()).isEqualByComparingTo("100.00");
        assertThat(service.toResponse(read("a", null, null, "100.00"), 0).fullCombo()).isTrue();   // 100.00이면 항상 풀콤보
        assertThat(service.toResponse(read("a", null, null, "100.01"), 0).achievementRate()).isNull(); // 범위 밖은 비운다
        assertThat(service.toResponse(read("a", null, null, "-0.01"), 0).achievementRate()).isNull();
        assertThat(service.toResponse(read("a", null, null, "0.00"), 0).achievementRate()).isEqualByComparingTo("0.00");
        assertThat(service.toResponse(read("a", null, null, "abc"), 0).achievementRate()).isNull();
        VisionResult missZero = new VisionResult("a", null, null, null, "90", 0, null, null);
        assertThat(service.toResponse(missZero, 0).fullCombo()).isTrue();    // 표시가 없어도 Miss 0이면 풀콤보
        VisionResult unknown = new VisionResult(null, "DRUM", "HARD", "12.5", null, null, null, null);
        RecognizeResultResponse u = service.toResponse(unknown, 0);
        assertThat(u.part()).isNull();       // 정해진 값이 아니면 비운다
        assertThat(u.difficulty()).isNull();
        assertThat(u.level()).isNull();      // 9.99 초과
        assertThat(u.fullCombo()).isNull();
    }
}
