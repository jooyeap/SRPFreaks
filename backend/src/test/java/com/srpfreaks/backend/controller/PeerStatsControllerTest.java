package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PeerStatsResponse;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.PeerStatsService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 같은 티어 유저 기록 API: 로그인한 본인의 id로만 집계하고, 서비스 결과를 그대로 내려준다. */
class PeerStatsControllerTest {

    private final PeerStatsService service = Mockito.mock(PeerStatsService.class);
    private final PeerStatsController controller = new PeerStatsController(service);

    @Test
    void 토큰의_사용자_id로_조회한다() {
        PeerStatsResponse expected = new PeerStatsResponse("SS 3", 8, List.of());
        Mockito.when(service.stats(7L, List.of(1L, 2L))).thenReturn(expected);

        assertThat(controller.get(new AuthenticatedUser(7L, Role.USER), List.of(1L, 2L))).isSameAs(expected);
    }
}
