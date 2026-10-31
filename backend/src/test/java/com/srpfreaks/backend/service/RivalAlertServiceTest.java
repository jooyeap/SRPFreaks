package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.RivalNotification;
import com.srpfreaks.backend.entity.RivalNotificationStatus;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RivalNotificationRepository;
import com.srpfreaks.backend.repository.RivalRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserBest;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 라이벌 역전 알림(D56)의 판정·전달 규칙. A(10) = 역전한 사람, B(20) = 받는 사람, 채보 300.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RivalAlertServiceTest {

    static final Long A = 10L;
    static final Long B = 20L;
    static final Long CHART = 300L;
    static final NoteOption SRN = NoteOption.SUPER_RANDOM_PLUS;
    /** 2026-10-31 15:00 서울 */
    static final Instant NOW = Instant.parse("2026-10-31T06:00:00Z");

    @Mock RivalRepository rivalRepository;
    @Mock RivalNotificationRepository notificationRepository;
    @Mock OptionRecordRepository optionRecordRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock UserRepository userRepository;
    @Mock AppSettingRepository appSettingRepository;

    RivalAlertService service;
    User a;
    User b;
    SongDifficulty chart;

    @BeforeEach
    void setUp() {
        service = new RivalAlertService(rivalRepository, notificationRepository, optionRecordRepository,
                songDifficultyRepository, userRepository, appSettingRepository, Clock.fixed(NOW, ZoneOffset.UTC));
        a = user(A, "Rumi");
        b = user(B, "HJY");
        Song song = Song.create("MEGALOVANIA", null, "test", null);
        ReflectionTestUtils.setField(song, "id", 1L);
        chart = SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("8.65"));
        ReflectionTestUtils.setField(chart, "id", CHART);
        when(userRepository.findById(A)).thenReturn(Optional.of(a));
        when(userRepository.findById(B)).thenReturn(Optional.of(b));
        when(rivalRepository.findMutualTargets(A)).thenReturn(List.of(b));
        when(rivalRepository.findMutualTargets(B)).thenReturn(List.of(a));
        when(songDifficultyRepository.getReferenceById(CHART)).thenReturn(chart);
        when(songDifficultyRepository.findByIdAndDeletedFalse(CHART)).thenReturn(Optional.of(chart));
        when(appSettingRepository.findAll()).thenReturn(List.of(
                AppSetting.create("rival.max_count", "5", null),
                AppSetting.create("rival.notify_delay_minutes", "10", null),
                AppSetting.create("rival.notify_daily_per_rival", "3", null),
                AppSetting.create("rival.notify_keep_days", "30", null)));
        when(notificationRepository.findFirstByRecipient_IdAndActor_IdAndSongDifficulty_IdAndStatus(any(), any(), any(), any()))
                .thenReturn(Optional.empty());
    }

    private static User user(Long id, String nickname) {
        User u = User.create("sub-" + id, id + "@example.com", nickname);
        ReflectionTestUtils.setField(u, "id", id);
        u.changeProfilePublic(true);
        return u;
    }

    private void recipientBest(String rate) {
        when(optionRecordRepository.findBestRatesForUsers(eq(CHART), eq(SRN), anyCollection()))
                .thenReturn(rate == null ? List.of() : List.of(new UserBest(B, new BigDecimal(rate))));
    }

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    // ---------- 판정 ----------

    @Test
    void 지고_있던_채보를_넘으면_10분_뒤에_보일_알림을_만든다() {
        recipientBest("96.10");

        service.detect(A, CHART, SRN, d("95.00"), d("96.40"));

        ArgumentCaptor<RivalNotification> captor = ArgumentCaptor.forClass(RivalNotification.class);
        verify(notificationRepository).save(captor.capture());
        RivalNotification n = captor.getValue();
        assertThat(n.getRecipient()).isSameAs(b);
        assertThat(n.getActor()).isSameAs(a);
        assertThat(n.getStatus()).isEqualTo(RivalNotificationStatus.PENDING);
        assertThat(n.getActorRate()).isEqualByComparingTo("96.40");
        assertThat(n.getRecipientRate()).isEqualByComparingTo("96.10");
        assertThat(n.getVisibleAt()).isEqualTo(NOW.plusSeconds(600));
    }

    @Test
    void 첫_기록이면_알림이_없다() {
        recipientBest("96.10");
        service.detect(A, CHART, SRN, null, d("99.00"));
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void 상대_기록이_없으면_알림이_없다() {
        recipientBest(null);
        service.detect(A, CHART, SRN, d("90.00"), d("99.00"));
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void 동점에서_이긴_것은_지고_있던_게_아니라서_알림이_없다() {
        recipientBest("96.10");
        service.detect(A, CHART, SRN, d("96.10"), d("97.00"));
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void 저장_뒤에도_못_넘었거나_같아지기만_하면_알림이_없다() {
        recipientBest("96.10");
        service.detect(A, CHART, SRN, d("90.00"), d("96.10"));
        service.detect(A, CHART, SRN, d("90.00"), d("95.00"));
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void 받는_사람이_알림을_껐거나_비공개면_알림이_없다() {
        recipientBest("96.10");
        b.changeRivalNotify(false);
        service.detect(A, CHART, SRN, d("90.00"), d("99.00"));

        b.changeRivalNotify(true);
        b.changeProfilePublic(false);
        service.detect(A, CHART, SRN, d("90.00"), d("99.00"));

        verify(notificationRepository, never()).save(any());
    }

    @Test
    void 십분_안에_같은_채보로_다시_넘으면_한_건으로_합친다() {
        recipientBest("96.10");
        RivalNotification pending = RivalNotification.pending(b, a, chart, d("96.40"), d("96.10"), NOW.plusSeconds(300), NOW);
        when(notificationRepository.findFirstByRecipient_IdAndActor_IdAndSongDifficulty_IdAndStatus(
                B, A, CHART, RivalNotificationStatus.PENDING)).thenReturn(Optional.of(pending));

        service.detect(A, CHART, SRN, d("95.00"), d("97.00"));

        verify(notificationRepository, never()).save(any());
        assertThat(pending.getActorRate()).isEqualByComparingTo("97.00");
        assertThat(pending.getVisibleAt()).isEqualTo(NOW.plusSeconds(600));
    }

    // ---------- 전달 ----------

    private RivalNotification due() {
        RivalNotification n = RivalNotification.pending(b, a, chart, d("96.40"), d("96.10"), NOW.minusSeconds(60), NOW.minusSeconds(660));
        when(notificationRepository.findDue(B, NOW)).thenReturn(List.of(n));
        return n;
    }

    private void bests(String actor, String recipient) {
        when(optionRecordRepository.findBestRate(A, CHART, SRN)).thenReturn(actor == null ? null : d(actor));
        when(optionRecordRepository.findBestRate(B, CHART, SRN)).thenReturn(recipient == null ? null : d(recipient));
    }

    @Test
    void 보일_시각이_지나고_여전히_역전이면_지금_값으로_보인다() {
        RivalNotification n = due();
        bests("96.80", "96.10");

        service.deliverDue(B, SRN);

        assertThat(n.getStatus()).isEqualTo(RivalNotificationStatus.SHOWN);
        assertThat(n.getActorRate()).isEqualByComparingTo("96.80");
        assertThat(n.getAlertDate()).isEqualTo(LocalDate.of(2026, 10, 31));
        assertThat(n.isBundled()).isFalse();
    }

    @Test
    void 그_사이_기록을_고쳐_역전이_아니게_됐으면_지운다() {
        RivalNotification n = due();
        bests("95.00", "96.10");

        service.deliverDue(B, SRN);

        verify(notificationRepository).delete(n);
        assertThat(n.getStatus()).isEqualTo(RivalNotificationStatus.PENDING);
    }

    @Test
    void 서로_라이벌이_아니게_됐으면_지운다() {
        RivalNotification n = due();
        bests("99.00", "96.10");
        when(rivalRepository.findMutualTargets(B)).thenReturn(List.of());

        service.deliverDue(B, SRN);

        verify(notificationRepository).delete(n);
    }

    @Test
    void 그날_한_상대에게서_3건이_보였으면_네번째는_묶음_줄이_된다() {
        RivalNotification n = due();
        bests("99.00", "96.10");
        when(notificationRepository.countByRecipient_IdAndActor_IdAndAlertDateAndBundledFalseAndStatus(
                B, A, LocalDate.of(2026, 10, 31), RivalNotificationStatus.SHOWN)).thenReturn(3L);
        when(notificationRepository.findFirstByRecipient_IdAndActor_IdAndAlertDateAndBundledTrue(any(), any(), any()))
                .thenReturn(Optional.empty());

        service.deliverDue(B, SRN);

        assertThat(n.isBundled()).isTrue();
        assertThat(n.getSongCount()).isEqualTo(1);
        assertThat(n.getStatus()).isEqualTo(RivalNotificationStatus.SHOWN);
    }

    @Test
    void 묶음_줄이_있으면_곡_수를_더하고_안_읽음으로_되돌린다() {
        RivalNotification n = due();
        bests("99.00", "96.10");
        RivalNotification bundle = RivalNotification.pending(b, a, chart, d("99.00"), d("96.10"), NOW.minusSeconds(3600), NOW);
        bundle.showAsBundle(d("99.00"), d("96.10"), LocalDate.of(2026, 10, 31));
        bundle.markRead(NOW);
        when(notificationRepository.countByRecipient_IdAndActor_IdAndAlertDateAndBundledFalseAndStatus(
                any(), any(), any(), any())).thenReturn(3L);
        when(notificationRepository.findFirstByRecipient_IdAndActor_IdAndAlertDateAndBundledTrue(
                B, A, LocalDate.of(2026, 10, 31))).thenReturn(Optional.of(bundle));

        service.deliverDue(B, SRN);

        assertThat(bundle.getSongCount()).isEqualTo(2);
        assertThat(bundle.getReadAt()).isNull();
        verify(notificationRepository).delete(n);
    }

    @Test
    void 하루는_서울_날짜로_센다() {
        // UTC 10/31 15:30 = 서울 11/01 00:30
        RivalNotification n = RivalNotification.pending(b, a, chart, d("96.40"), d("96.10"),
                Instant.parse("2026-10-31T15:30:00Z"), NOW);
        Clock late = Clock.fixed(Instant.parse("2026-10-31T16:00:00Z"), ZoneOffset.UTC);
        service = new RivalAlertService(rivalRepository, notificationRepository, optionRecordRepository,
                songDifficultyRepository, userRepository, appSettingRepository, late);
        when(notificationRepository.findDue(eq(B), any())).thenReturn(List.of(n));
        bests("99.00", "96.10");

        service.deliverDue(B, SRN);

        assertThat(n.getAlertDate()).isEqualTo(LocalDate.of(2026, 11, 1));
    }
}
