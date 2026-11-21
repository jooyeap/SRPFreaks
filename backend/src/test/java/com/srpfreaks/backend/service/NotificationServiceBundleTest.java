package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.NotificationResponse;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RivalBundleSongsResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.RivalNotificationStatus;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.NotificationKey;
import com.srpfreaks.backend.mapper.NotificationMapper;
import com.srpfreaks.backend.mapper.RivalBundleCountRow;
import com.srpfreaks.backend.mapper.RivalBundleSongRow;
import com.srpfreaks.backend.mapper.RivalBundleSummaryRow;
import com.srpfreaks.backend.repository.RivalNotificationRepository;
import com.srpfreaks.backend.repository.TierNotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 라이벌 묶음 알림의 곡 목록 API와 목록 응답의 미리보기·missingCount(D86). */
class NotificationServiceBundleTest {

    static final Long ME = 7L;
    static final Long RIVAL = 9L;
    static final Long BUNDLE_ID = 100L;
    static final LocalDate DAY = LocalDate.of(2026, 11, 15);
    static final Instant T = Instant.parse("2026-11-15T03:00:00Z");

    NotificationMapper mapper = mock(NotificationMapper.class);
    RivalNotificationRepository repository = mock(RivalNotificationRepository.class);
    NotificationService service;
    RivalNotification bundle;

    @BeforeEach
    void setUp() {
        service = new NotificationService(mock(RivalAlertService.class), mock(TierAlertService.class), mapper, repository,
                mock(TierNotificationRepository.class));
        User me = user(ME, "Me");
        User rival = user(RIVAL, "HJY");
        Song song = Song.create("첫 곡", null, "test", null);
        SongDifficulty chart = SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("9.50"));
        bundle = RivalNotification.pending(me, rival, chart, new BigDecimal("94.65"), new BigDecimal("94.30"), T, T);
        bundle.showAsBundle(new BigDecimal("94.65"), new BigDecimal("94.30"), DAY);
        ReflectionTestUtils.setField(bundle, "id", BUNDLE_ID);
    }

    private static User user(Long id, String nickname) {
        User u = User.create("sub-" + id, id + "@example.com", nickname);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private void songCount(int count) {
        for (int i = 1; i < count; i++) {
            bundle.addToBundle(T);
        }
    }

    @Test
    void 곡_목록은_본인의_묶음_줄이면_저장된_값을_쪽으로_돌려준다() {
        songCount(3);
        when(repository.findByIdAndRecipient_IdAndStatus(BUNDLE_ID, ME, RivalNotificationStatus.SHOWN)).thenReturn(Optional.of(bundle));
        when(mapper.countBundleSongs(ME, RIVAL, DAY, BUNDLE_ID)).thenReturn(3L);
        when(mapper.findBundleSongs(ME, RIVAL, DAY, BUNDLE_ID, 20, 0)).thenReturn(List.of(
                new RivalBundleSongRow(1L, "첫 곡", "BASS", "MASTER", new BigDecimal("94.65"), new BigDecimal("94.30"))));
        when(mapper.findBundleMemberCounts(ME, List.of(BUNDLE_ID))).thenReturn(List.of(new RivalBundleCountRow(BUNDLE_ID, 2L)));

        RivalBundleSongsResponse response = service.rivalBundleSongs(ME, BUNDLE_ID, 0, 20);

        assertThat(response.actorNickname()).isEqualTo("HJY");
        assertThat(response.songCount()).isEqualTo(3);
        assertThat(response.missingCount()).isZero();
        assertThat(response.songs().totalElements()).isEqualTo(3);
        assertThat(response.songs().content()).hasSize(1);
        assertThat(response.songs().content().get(0).part()).isEqualTo(InstrumentPart.BASS);
        assertThat(response.songs().content().get(0).myRate()).isEqualByComparingTo("94.30");
    }

    @Test
    void 남의_알림이거나_없는_알림은_404다() {
        when(repository.findByIdAndRecipient_IdAndStatus(BUNDLE_ID, 99L, RivalNotificationStatus.SHOWN)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rivalBundleSongs(99L, BUNDLE_ID, 0, 20))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(mapper, never()).findBundleSongs(any(), any(), any(), any(), anyInt(), anyLong());
    }

    @Test
    void 묶음이_아닌_따로_보이는_알림도_404다() {
        RivalNotification single = RivalNotification.pending(bundle.getRecipient(), bundle.getActor(), bundle.getSongDifficulty(),
                new BigDecimal("95.00"), new BigDecimal("94.00"), T, T);
        single.show(new BigDecimal("95.00"), new BigDecimal("94.00"), DAY);
        when(repository.findByIdAndRecipient_IdAndStatus(5L, ME, RivalNotificationStatus.SHOWN)).thenReturn(Optional.of(single));

        assertThatThrownBy(() -> service.rivalBundleSongs(ME, 5L, 0, 20))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    void 쪽_크기는_1에서_50으로_제한된다() {
        when(repository.findByIdAndRecipient_IdAndStatus(BUNDLE_ID, ME, RivalNotificationStatus.SHOWN)).thenReturn(Optional.of(bundle));
        when(mapper.findBundleMemberCounts(any(), any())).thenReturn(List.of());

        service.rivalBundleSongs(ME, BUNDLE_ID, -3, 500);

        verify(mapper).findBundleSongs(ME, RIVAL, DAY, BUNDLE_ID, 50, 0);
    }

    @Test
    void 옛_묶음은_합쳐진_줄이_없어_missingCount가_곡_수_빼기_1이다() {
        songCount(5);
        when(repository.findByIdAndRecipient_IdAndStatus(BUNDLE_ID, ME, RivalNotificationStatus.SHOWN)).thenReturn(Optional.of(bundle));
        when(mapper.findBundleMemberCounts(ME, List.of(BUNDLE_ID))).thenReturn(List.of(new RivalBundleCountRow(BUNDLE_ID, 0L)));

        assertThat(service.rivalBundleSongs(ME, BUNDLE_ID, 0, 20).missingCount()).isEqualTo(4);
    }

    @Test
    void missingCount는_음수가_되지_않는다() {
        assertThat(NotificationService.missingCount(3, 2)).isZero();
        assertThat(NotificationService.missingCount(3, 5)).isZero();
        assertThat(NotificationService.missingCount(1, 0)).isZero();
        assertThat(NotificationService.missingCount(6, 2)).isEqualTo(3);
    }

    @Test
    void 알림_목록의_묶음_줄에는_곡명_미리보기와_missingCount가_붙고_따로_보이는_줄은_비어_있다() {
        songCount(4);
        RivalNotification single = RivalNotification.pending(bundle.getRecipient(), bundle.getActor(), bundle.getSongDifficulty(),
                new BigDecimal("95.00"), new BigDecimal("94.00"), T, T);
        single.show(new BigDecimal("95.00"), new BigDecimal("94.00"), DAY);
        ReflectionTestUtils.setField(single, "id", 101L);
        when(mapper.countAll(ME)).thenReturn(2L);
        when(mapper.findPage(ME, 20, 0)).thenReturn(List.of(new NotificationKey("RIVAL", BUNDLE_ID), new NotificationKey("RIVAL", 101L)));
        when(repository.findByRecipient_IdAndStatusAndIdIn(any(), any(), any())).thenReturn(List.of(bundle, single));
        when(mapper.findBundlePreviews(ME, List.of(BUNDLE_ID))).thenReturn(List.of(
                new RivalBundleSummaryRow(BUNDLE_ID, "둘째 곡", 1), new RivalBundleSummaryRow(BUNDLE_ID, "셋째 곡", 2)));
        when(mapper.findBundleMemberCounts(ME, List.of(BUNDLE_ID))).thenReturn(List.of(new RivalBundleCountRow(BUNDLE_ID, 2L)));

        PageResponse<NotificationResponse> page = service.list(ME, NoteOption.SUPER_RANDOM_PLUS, null, 0, 20);

        NotificationResponse b = page.content().get(0);
        assertThat(b.previewTitles()).containsExactly("첫 곡", "둘째 곡", "셋째 곡");
        assertThat(b.missingCount()).isEqualTo(1);   // 4곡 − 첫 곡 1 − 남은 줄 2
        NotificationResponse s = page.content().get(1);
        assertThat(s.previewTitles()).isEmpty();
        assertThat(s.missingCount()).isZero();
        // 쪽 전체에서 묶음 정보는 쿼리 한 번씩이다(N+1 없음)
        verify(mapper, Mockito.times(1)).findBundlePreviews(any(), any());
        verify(mapper, Mockito.times(1)).findBundleMemberCounts(any(), any());
    }

    @Test
    void 묶음_줄이_없는_쪽은_묶음_쿼리를_하지_않는다() {
        RivalNotification single = RivalNotification.pending(bundle.getRecipient(), bundle.getActor(), bundle.getSongDifficulty(),
                new BigDecimal("95.00"), new BigDecimal("94.00"), T, T);
        single.show(new BigDecimal("95.00"), new BigDecimal("94.00"), DAY);
        ReflectionTestUtils.setField(single, "id", 101L);
        when(mapper.findPage(ME, 20, 0)).thenReturn(List.of(new NotificationKey("RIVAL", 101L)));
        when(repository.findByRecipient_IdAndStatusAndIdIn(any(), any(), any())).thenReturn(List.of(single));

        service.list(ME, NoteOption.SUPER_RANDOM_PLUS, null, 0, 20);

        verify(mapper, never()).findBundlePreviews(any(), any());
    }
}
