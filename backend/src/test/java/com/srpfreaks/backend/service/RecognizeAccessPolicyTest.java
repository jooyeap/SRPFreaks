package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RecognizeStatusResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.RecognizeUsage;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.RecognizeUsageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 사진 입력(D55) 권한·한도 판단. 시각은 고정한다: 2026-10-28 14:00 서울(05:00 UTC). */
@ExtendWith(MockitoExtension.class)
class RecognizeAccessPolicyTest {

    private static final Instant NOW = Instant.parse("2026-10-28T05:00:00Z");
    private static final Instant SEOUL_MIDNIGHT = Instant.parse("2026-10-27T15:00:00Z");   // 10-28 00:00 서울

    @Mock AppSettingRepository settingRepository;
    @Mock RecognizeUsageRepository usageRepository;
    RecognizeAccessPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new RecognizeAccessPolicy(settingRepository, usageRepository, Clock.fixed(NOW, ZoneOffset.UTC));
        settings("true", "ADMIN", "30", "300");
    }

    private void settings(String enabled, String role, String weekly, String daily) {
        lenient().when(settingRepository.findAll()).thenReturn(List.of(
                AppSetting.create("recognize.enabled", enabled, null),
                AppSetting.create("recognize.min_role", role, null),
                AppSetting.create("recognize.weekly_limit", weekly, null),
                AppSetting.create("recognize.daily_total_limit", daily, null),
                AppSetting.create("rating.bonus", "3.2", null)));   // 다른 설정은 섞여 있어도 무시한다
    }

    @Test
    void 꺼져_있으면_누구도_못_쓴다() {
        settings("false", "USER", "30", "300");
        RecognizeStatusResponse s = policy.status(1L, Role.ROOT);
        assertThat(s.available()).isFalse();
        assertThat(s.reason()).isEqualTo("DISABLED");
    }

    @Test
    void 시험_기간에는_USER는_ROLE로_막히고_ADMIN_ROOT는_쓴다() {
        assertThat(policy.status(1L, Role.USER).reason()).isEqualTo("ROLE");
        assertThat(policy.status(1L, Role.ADMIN).available()).isTrue();
        assertThat(policy.status(1L, Role.ROOT).available()).isTrue();
    }

    @Test
    void 설정을_USER로_바꾸면_USER도_쓴다() {
        settings("true", "USER", "30", "300");
        RecognizeStatusResponse s = policy.status(1L, Role.USER);
        assertThat(s.available()).isTrue();
        assertThat(s.remaining()).isEqualTo(30);
        assertThat(s.weeklyLimit()).isEqualTo(30);
    }

    @Test
    void 최근_7일에_쓴_만큼_줄고_다_쓰면_가장_오래된_사용_7일_뒤에_돌아온다() {
        Instant since = NOW.minusSeconds(7 * 86400);
        when(usageRepository.countByUser_IdAndUsedAtAfter(1L, since)).thenReturn(12L);
        assertThat(policy.status(1L, Role.ADMIN).remaining()).isEqualTo(18);

        when(usageRepository.countByUser_IdAndUsedAtAfter(1L, since)).thenReturn(30L);
        Instant oldest = Instant.parse("2026-10-22T03:00:00Z");
        when(usageRepository.findFirstByUser_IdAndUsedAtAfterOrderByUsedAtAsc(1L, since))
                .thenReturn(Optional.of(RecognizeUsage.of(null, oldest)));
        RecognizeStatusResponse s = policy.status(1L, Role.ADMIN);
        assertThat(s.available()).isFalse();
        assertThat(s.reason()).isEqualTo("WEEKLY_LIMIT");
        assertThat(s.remaining()).isZero();
        assertThat(s.nextRefillAt()).isEqualTo(Instant.parse("2026-10-29T03:00:00Z"));
    }

    @Test
    void 오늘_서울_날짜_전체_한도를_넘으면_내일_0시에_풀린다() {
        when(usageRepository.countByUsedAtGreaterThanEqual(SEOUL_MIDNIGHT)).thenReturn(300L);
        RecognizeStatusResponse s = policy.status(1L, Role.ADMIN);
        assertThat(s.available()).isFalse();
        assertThat(s.reason()).isEqualTo("DAILY_LIMIT");
        assertThat(s.remaining()).isEqualTo(30);
        assertThat(s.nextRefillAt()).isEqualTo(Instant.parse("2026-10-28T15:00:00Z"));
    }

    @Test
    void 기록할_때_8일_지난_줄을_함께_지운다() {
        RecognizeUsage usage = RecognizeUsage.of(null, NOW);
        policy.record(usage);
        verify(usageRepository).deleteOlderThan(eq(NOW.minusSeconds(8 * 86400)));
        verify(usageRepository).save(any(RecognizeUsage.class));
    }
}
