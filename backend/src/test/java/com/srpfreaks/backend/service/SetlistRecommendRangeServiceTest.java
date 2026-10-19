package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SetlistRecommendRangeRequest;
import com.srpfreaks.backend.dto.SetlistRecommendRangeResponse;
import com.srpfreaks.backend.entity.SetlistRecommendRange;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.SetlistRecommendRangeRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SetlistRecommendRangeServiceTest {

    @Mock SetlistRecommendRangeRepository rangeRepository;
    @Mock UserRepository userRepository;

    SetlistRecommendRangeService service;
    User user;

    @BeforeEach
    void setUp() {
        service = new SetlistRecommendRangeService(rangeRepository, userRepository);
        user = User.create("sub-1", "a@example.com", "tester");
    }

    private static SetlistRecommendRangeRequest request(String ssMin, String ssMax, String sMin, String sMax) {
        return new SetlistRecommendRangeRequest(new BigDecimal(ssMin), new BigDecimal(ssMax), new BigDecimal(sMin), new BigDecimal(sMax));
    }

    private void assertRejected(SetlistRecommendRangeRequest request) {
        assertThatThrownBy(() -> service.save(1L, request))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
        verify(rangeRepository, never()).save(any(SetlistRecommendRange.class));
    }

    @Test
    void 설정이_없으면_새로_만들어_저장한다() {
        when(rangeRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(rangeRepository.save(any(SetlistRecommendRange.class))).thenAnswer(i -> i.getArgument(0));

        SetlistRecommendRangeResponse response = service.save(1L, request("-0.6", "-0.1", "-0.1", "0.4"));

        ArgumentCaptor<SetlistRecommendRange> saved = ArgumentCaptor.forClass(SetlistRecommendRange.class);
        verify(rangeRepository).save(saved.capture());
        assertThat(saved.getValue().getUser()).isSameAs(user);
        assertThat(saved.getValue().getSsMin()).isEqualByComparingTo("-0.6");
        assertThat(response.sMax()).isEqualByComparingTo("0.4");
    }

    @Test
    void 이미_있으면_같은_줄을_고친다() {
        SetlistRecommendRange existing = SetlistRecommendRange.create(user,
                new BigDecimal("-0.6"), new BigDecimal("-0.1"), new BigDecimal("-0.1"), new BigDecimal("0.4"));
        when(rangeRepository.findByUserId(1L)).thenReturn(Optional.of(existing));
        when(rangeRepository.save(existing)).thenReturn(existing);

        SetlistRecommendRangeResponse response = service.save(1L, request("-1.00", "-0.50", "0.00", "1.25"));

        assertThat(existing.getSsMin()).isEqualByComparingTo("-1.00");
        assertThat(existing.getSMax()).isEqualByComparingTo("1.25");
        assertThat(response.ssMax()).isEqualByComparingTo("-0.50");
        verify(userRepository, never()).getReferenceById(any());
    }

    @Test
    void 하한과_상한이_같아도_된다() {
        when(rangeRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(rangeRepository.save(any(SetlistRecommendRange.class))).thenAnswer(i -> i.getArgument(0));

        assertThat(service.save(1L, request("-0.3", "-0.3", "0", "0")).ssMin()).isEqualByComparingTo("-0.3");
    }

    @Test
    void 하한이_상한보다_크면_거절한다() {
        assertRejected(request("-0.1", "-0.6", "-0.1", "0.4"));   // SS 기준
        assertRejected(request("-0.6", "-0.1", "0.5", "0.4"));    // S 기준
    }

    @Test
    void 범위_밖_값과_소수_셋째_자리는_거절한다() {
        assertRejected(request("-3.01", "-0.1", "-0.1", "0.4"));
        assertRejected(request("-0.6", "-0.1", "-0.1", "3.01"));
        assertRejected(request("-0.601", "-0.1", "-0.1", "0.4"));
    }

    @Test
    void 경계값_마이너스3_플러스3은_받는다() {
        when(rangeRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(userRepository.getReferenceById(1L)).thenReturn(user);
        when(rangeRepository.save(any(SetlistRecommendRange.class))).thenAnswer(i -> i.getArgument(0));

        SetlistRecommendRangeResponse response = service.save(1L, request("-3.00", "3.00", "-3.00", "3.00"));

        assertThat(response.ssMin()).isEqualByComparingTo("-3.00");
        assertThat(response.sMax()).isEqualByComparingTo("3.00");
    }

    @Test
    void 초기화하면_내_설정만_지운다() {
        service.reset(1L);

        verify(rangeRepository).deleteByUserId(1L);
    }
}
