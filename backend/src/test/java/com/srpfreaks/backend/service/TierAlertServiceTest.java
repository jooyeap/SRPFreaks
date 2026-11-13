package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.dto.NotificationKind;
import com.srpfreaks.backend.dto.NotificationResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.TierNotification;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.TierAlertMapper;
import com.srpfreaks.backend.mapper.TierAlertRow;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.TierNotificationRepository;
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
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 서열표 변경 알림(D61)의 생성 규칙. 사용자 7, 커서 100, 지금 로그 끝 110.
 * 점수 예시값은 직접 계산했다(기본 설정: 기준점 6.0, 5T-15 / 10T-45, 80, 95, 3.2, x20):
 *  - T 6.5, A 90 : R 17.5, V = 17.5x0.8 + 3.2x10/15 = 14 + 2.1333.. = 16.1333.., 점수 322.67
 *  - T 7.0, A 90 : R 20,   V = 16 + 2.1333.. = 18.1333..,                       점수 362.67 (차이 +40.00)
 *  - A 0이면 기준 난이도가 바뀌어도 전·후 모두 0점
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TierAlertServiceTest {

    static final Long ME = 7L;
    static final NoteOption SRN = NoteOption.SUPER_RANDOM_PLUS;
    static final Instant NOW = Instant.parse("2026-11-02T06:00:00Z");
    static final RatingCalculator CALC = new RatingCalculator(RatingCalculatorTest.defaults());

    @Mock TierAlertMapper mapper;
    @Mock TierNotificationRepository notificationRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock UserRepository userRepository;
    @Mock AppSettingRepository appSettingRepository;

    TierAlertService service;
    User me;

    @BeforeEach
    void setUp() {
        service = new TierAlertService(mapper, notificationRepository, songDifficultyRepository, userRepository,
                appSettingRepository, Clock.fixed(NOW, ZoneOffset.UTC));
        me = User.create("sub-7", "me@example.com", null);
        ReflectionTestUtils.setField(me, "id", ME);
        me.moveTierNotifyCursor(100L);
        when(userRepository.findByIdForUpdate(ME)).thenReturn(Optional.of(me));
        when(mapper.maxAuditLogId()).thenReturn(110L);
        when(appSettingRepository.findAll()).thenReturn(List.of(
                AppSetting.create("tier.notify_keep_days", "30", null),
                AppSetting.create("tier.notify_bundle_over", "5", null)));
        when(songDifficultyRepository.getReferenceById(anyLong())).thenAnswer(inv -> chart(inv.getArgument(0)));
    }

    private static SongDifficulty chart(Long id) {
        Song song = Song.create("곡" + id, null, "test", null);
        ReflectionTestUtils.setField(song, "id", id);
        SongDifficulty d = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.00"));
        ReflectionTestUtils.setField(d, "id", id);
        return d;
    }

    private static TierAlertRow row(long logId, long chartId, String before, String after, String rate) {
        return new TierAlertRow(logId, LocalDateTime.of(2026, 11, 2, 5, 0).plusMinutes(logId), chartId, before, after,
                new BigDecimal(rate));
    }

    private void rows(TierAlertRow... rows) {
        when(mapper.findChanges(eq(ME), eq("SUPER_RANDOM_PLUS"), eq(100L), eq(110L), any())).thenReturn(List.of(rows));
    }

    private List<TierNotification> saved(int times) {
        ArgumentCaptor<TierNotification> captor = ArgumentCaptor.forClass(TierNotification.class);
        verify(notificationRepository, times(times)).save(captor.capture());
        return captor.getAllValues();
    }

    @Test
    void 기준_난이도가_바뀌어_내_점수가_달라지면_알림을_만들고_커서를_옮긴다() {
        rows(row(105, 1, "6.5", "7.0", "90.00"));

        service.deliver(ME, SRN, CALC);

        TierNotification n = saved(1).get(0);
        assertThat(n.getBeforeTier()).isEqualByComparingTo("6.5");
        assertThat(n.getAfterTier()).isEqualByComparingTo("7.0");
        assertThat(n.getMyRate()).isEqualByComparingTo("90.00");
        assertThat(n.isBundled()).isFalse();
        assertThat(n.getChangedAt()).isEqualTo(Instant.parse("2026-11-02T06:45:00Z"));
        assertThat(me.getTierNotifyCursor()).isEqualTo(110L);
    }

    @Test
    void 미정에서_값이_생기거나_값이_미정이_되어도_알린다() {
        rows(row(101, 1, null, "6.5", "90.00"), row(102, 2, "7.0", null, "85.00"));

        service.deliver(ME, SRN, CALC);

        assertThat(saved(2)).extracting(TierNotification::getAfterTier).containsExactly(new BigDecimal("6.5"), null);
    }

    @Test
    void 달성률이_0이면_점수가_그대로라_알리지_않지만_커서는_옮긴다() {
        rows(row(105, 1, "6.5", "7.0", "0.00"));

        service.deliver(ME, SRN, CALC);

        verify(notificationRepository, never()).save(any());
        assertThat(me.getTierNotifyCursor()).isEqualTo(110L);
    }

    @Test
    void 같은_채보가_여러_번_바뀌면_처음_전_값과_마지막_후_값으로_합친다() {
        rows(row(101, 1, "6.5", "6.8", "90.00"), row(102, 2, "5.0", "5.5", "90.00"), row(103, 1, "6.8", "7.2", "90.00"));

        service.deliver(ME, SRN, CALC);

        List<TierNotification> all = saved(2);
        assertThat(all.get(0).getSongDifficulty().getId()).isEqualTo(1L);
        assertThat(all.get(0).getBeforeTier()).isEqualByComparingTo("6.5");
        assertThat(all.get(0).getAfterTier()).isEqualByComparingTo("7.2");
        assertThat(all.get(1).getSongDifficulty().getId()).isEqualTo(2L);
    }

    @Test
    void 바뀌었다가_원래_값으로_돌아오면_알리지_않는다() {
        rows(row(101, 1, "6.5", "6.8", "90.00"), row(102, 1, "6.8", "6.5", "90.00"));

        service.deliver(ME, SRN, CALC);

        verify(notificationRepository, never()).save(any());
    }

    @Test
    void 묶음_기준_5건까지는_따로_만든다() {
        rows(manyRows(5));

        service.deliver(ME, SRN, CALC);

        assertThat(saved(5)).noneMatch(TierNotification::isBundled);
    }

    @Test
    void 묶음_기준을_넘으면_한_줄로_묶는다() {
        rows(manyRows(6));

        service.deliver(ME, SRN, CALC);

        TierNotification bundle = saved(1).get(0);
        assertThat(bundle.isBundled()).isTrue();
        assertThat(bundle.getSongCount()).isEqualTo(6);
        assertThat(bundle.getSongDifficulty().getId()).isEqualTo(1L);
        // 묶음 시각 = 가장 늦은 변경(로그 106)
        assertThat(bundle.getChangedAt()).isEqualTo(Instant.parse("2026-11-02T06:46:00Z"));
    }

    private static TierAlertRow[] manyRows(int n) {
        List<TierAlertRow> list = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            list.add(row(100 + i, i, "6.5", "7.0", "90.00"));
        }
        return list.toArray(TierAlertRow[]::new);
    }

    @Test
    void 커서가_비어_있으면_지금의_끝으로_채우고_과거_변경은_알리지_않는다() {
        ReflectionTestUtils.setField(me, "tierNotifyCursor", null);

        service.deliver(ME, SRN, CALC);

        assertThat(me.getTierNotifyCursor()).isEqualTo(110L);
        verify(mapper, never()).findChanges(any(), anyString(), anyLong(), anyLong(), any());
    }

    @Test
    void 알림을_끄면_만들지_않고_커서도_그대로다() {
        me.changeTierNotify(false, 0L);
        rows(row(105, 1, "6.5", "7.0", "90.00"));

        service.deliver(ME, SRN, CALC);

        verify(mapper, never()).findChanges(any(), anyString(), anyLong(), anyLong(), any());
        assertThat(me.getTierNotifyCursor()).isEqualTo(100L);
    }

    @Test
    void 새_로그가_없으면_후보를_읽지_않는다() {
        when(mapper.maxAuditLogId()).thenReturn(100L);

        service.deliver(ME, SRN, CALC);

        verify(mapper, never()).findChanges(any(), anyString(), anyLong(), anyLong(), any());
    }

    @Test
    void 남의_알림을_읽음으로_하면_404() {
        when(notificationRepository.findByIdAndUser_Id(5L, ME)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markRead(ME, 5L)).isInstanceOf(ApiException.class);
    }

    @Test
    void 응답의_점수는_같은_달성률로_계산한_전후와_차이다() {
        TierNotification n = TierNotification.single(me, chart(1L), new BigDecimal("6.5"), new BigDecimal("7.0"),
                new BigDecimal("90.00"), NOW, NOW);

        NotificationResponse r = NotificationResponse.from(n, CALC);

        assertThat(r.kind()).isEqualTo(NotificationKind.TIER);
        assertThat(r.beforeScore()).isEqualByComparingTo("322.67");
        assertThat(r.afterScore()).isEqualByComparingTo("362.67");
        assertThat(r.scoreDiff()).isEqualByComparingTo("40.00");
        assertThat(r.actorUserId()).isNull();
    }

    @Test
    void 미정이_있으면_그쪽_점수와_차이는_비운다() {
        TierNotification n = TierNotification.single(me, chart(1L), null, new BigDecimal("7.0"),
                new BigDecimal("90.00"), NOW, NOW);

        NotificationResponse r = NotificationResponse.from(n, CALC);

        assertThat(r.beforeScore()).isNull();
        assertThat(r.afterScore()).isEqualByComparingTo("362.67");
        assertThat(r.scoreDiff()).isNull();
    }
}
