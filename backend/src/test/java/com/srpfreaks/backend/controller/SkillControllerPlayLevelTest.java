package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PlayLevelResponse;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.PlayLevelEstimate;
import com.srpfreaks.backend.service.PlayLevelEstimator;
import com.srpfreaks.backend.service.SkillService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** 내 평소 난이도 API: 로그인한 본인의 id로만 추정하고, 추정 결과를 그대로 내려준다. */
class SkillControllerPlayLevelTest {

    private final PlayLevelEstimator estimator = Mockito.mock(PlayLevelEstimator.class);
    private final SkillController controller = new SkillController(Mockito.mock(SkillService.class), estimator);
    private final AuthenticatedUser user = new AuthenticatedUser(7L, Role.USER);

    @Test
    void READY면_평균_난이도를_내려준다() {
        Mockito.when(estimator.estimate(7L)).thenReturn(PlayLevelEstimate.ready(new BigDecimal("6.13"), 15, 25));

        PlayLevelResponse response = controller.myPlayLevel(user);

        assertThat(response.status()).isEqualTo(PlayLevelEstimate.Status.READY);
        assertThat(response.tier()).isEqualByComparingTo("6.13");
    }

    @Test
    void 신규나_기록이_모자라면_평균_없이_상태만_내려준다() {
        Mockito.when(estimator.estimate(7L)).thenReturn(PlayLevelEstimate.newPlayer());
        assertThat(controller.myPlayLevel(user)).isEqualTo(new PlayLevelResponse(PlayLevelEstimate.Status.NEW_PLAYER, null));

        Mockito.when(estimator.estimate(7L)).thenReturn(PlayLevelEstimate.insufficient(3, 4));
        assertThat(controller.myPlayLevel(user)).isEqualTo(new PlayLevelResponse(PlayLevelEstimate.Status.INSUFFICIENT, null));
    }
}
