package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.common.error.GlobalExceptionHandler;
import com.srpfreaks.backend.dto.SongRankingResponse;
import com.srpfreaks.backend.dto.SongRankingResponse.Item;
import com.srpfreaks.backend.dto.SongRankingResponse.Me;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongRankingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 곡별 순위 API의 요청 처리: 사용자 id는 토큰(principal)에서만 쓰고, 응답에는 이메일·역할·Google ID 필드가 없다.
 * 인증 자체(로그인 없이 부르면 401)는 EndpointAuthSweepTest(Testcontainers)가 모든 /api/v1 경로에 대해 점검하고,
 * 이 경로가 공개 읽기 경로가 아니라는 것은 PublicReadPathsTest가 확인한다.
 */
class SongRankingControllerTest {

    private static final long USER = 7L;

    private final SongRankingService service = Mockito.mock(SongRankingService.class);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        HandlerMethodArgumentResolver principal = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                          NativeWebRequest request, WebDataBinderFactory binderFactory) {
                return new AuthenticatedUser(USER, Role.USER);
            }
        };
        mvc = MockMvcBuilders.standaloneSetup(new SongRankingController(service))
                .setCustomArgumentResolvers(principal)
                .setControllerAdvice(new GlobalExceptionHandler(Clock.systemUTC()))
                .build();
    }

    @Test
    void 토큰의_본인_id와_기본_페이지로_부르고_응답_필드를_확인한다() throws Exception {
        when(service.ranking(USER, 12L, 0, 20)).thenReturn(new SongRankingResponse(12L, 18, 0, 20, 1,
                Me.of(7, new BigDecimal("96.12"), AchievementStage.SS),
                List.of(new Item(1, 45L, "예시닉", new BigDecimal("100.00"), AchievementStage.EXC, false),
                        new Item(7, USER, "나", new BigDecimal("96.12"), AchievementStage.SS, true))));

        // 다른 사람 id를 쿼리로 보내도 무시된다(받는 파라미터가 없다)
        mvc.perform(get("/api/v1/difficulties/12/ranking").param("userId", "99"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.songDifficultyId").value(12))
                .andExpect(jsonPath("$.players").value(18))
                .andExpect(jsonPath("$.me.inRanking").value(true))
                .andExpect(jsonPath("$.me.rank").value(7))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[0].userId").value(45))
                .andExpect(jsonPath("$.items[0].isMe").value(false))
                .andExpect(jsonPath("$.items[1].isMe").value(true));

        verify(service).ranking(USER, 12L, 0, 20);
    }

    @Test
    void 응답_어디에도_이메일_역할_구글_아이디_티어_총점_필드가_없다() throws Exception {
        when(service.ranking(USER, 12L, 0, 20)).thenReturn(new SongRankingResponse(12L, 1, 0, 20, 1, Me.notInRanking(),
                List.of(new Item(1, 45L, "예시닉", new BigDecimal("100.00"), AchievementStage.EXC, false))));

        MvcResult result = mvc.perform(get("/api/v1/difficulties/12/ranking")).andExpect(status().isOk()).andReturn();
        String body = result.getResponse().getContentAsString().toLowerCase();

        for (String forbidden : new String[] {"email", "role", "googlesub", "google", "tier", "totalscore", "password", "token"}) {
            assertThat(body).as("응답에 '%s'가 들어 있으면 안 된다", forbidden).doesNotContain(forbidden);
        }
    }

    @Test
    void 비공개인_나는_달성률_없이_순위에_없음만_나온다() throws Exception {
        when(service.ranking(USER, 12L, 0, 20)).thenReturn(new SongRankingResponse(12L, 0, 0, 20, 0, Me.notInRanking(), List.of()));

        mvc.perform(get("/api/v1/difficulties/12/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.me.inRanking").value(false))
                .andExpect(jsonPath("$.me.rank").doesNotExist())            // 값이 없다(null이거나 필드가 없다)
                .andExpect(jsonPath("$.me.achievementRate").doesNotExist())
                .andExpect(jsonPath("$.me.stage").doesNotExist())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void page와_size를_그대로_서비스에_넘긴다_보정은_서비스가_한다() throws Exception {
        when(service.ranking(USER, 12L, 2, 3)).thenReturn(new SongRankingResponse(12L, 0, 2, 3, 0, null, List.of()));

        mvc.perform(get("/api/v1/difficulties/12/ranking").param("page", "2").param("size", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.me").doesNotExist());

        verify(service).ranking(USER, 12L, 2, 3);
    }

    @Test
    void 채보가_없으면_404이고_공통_에러_형식이다() throws Exception {
        when(service.ranking(USER, 99L, 0, 20)).thenThrow(new ApiException(ErrorCode.NOT_FOUND));

        mvc.perform(get("/api/v1/difficulties/99/ranking")).andExpect(status().isNotFound());
    }

    @Test
    void 채보_id가_숫자가_아니면_400이다() throws Exception {
        mvc.perform(get("/api/v1/difficulties/abc/ranking")).andExpect(status().isBadRequest());
    }
}
