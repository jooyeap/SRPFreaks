package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.GlobalExceptionHandler;
import com.srpfreaks.backend.dto.RatingSimulationResponse;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RatingSimulationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mockito;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.math.BigDecimal;
import java.time.Clock;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;

/**
 * 시뮬레이션 API의 요청 처리: 달성률 경계값을 400으로 거절하고(공통 에러 형식), 사용자 id는 토큰(principal)에서만 쓴다.
 * 인증 자체(로그인 없이 부르면 401)는 EndpointAuthSweepTest(Testcontainers)가 모든 /api/v1 경로에 대해 점검한다.
 */
class RatingSimulationControllerTest {

    private static final long USER = 7L;

    private final RatingSimulationService service = Mockito.mock(RatingSimulationService.class);
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
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mvc = MockMvcBuilders.standaloneSetup(new RatingSimulationController(service))
                .setCustomArgumentResolvers(principal)
                .setControllerAdvice(new GlobalExceptionHandler(Clock.systemUTC()))
                .setValidator(validator)
                .build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.00", "0", "100.00", "100", "95.5"})
    void 범위_안의_달성률은_본인_id로_계산한다(String rate) throws Exception {
        when(service.simulate(eq(USER), eq(10L), any())).thenReturn(Mockito.mock(RatingSimulationResponse.class));

        mvc.perform(get("/api/v1/skills/me/simulate").param("songDifficultyId", "10").param("achievement", rate))
                .andExpect(status().isOk());

        verify(service).simulate(USER, 10L, new BigDecimal(rate));
    }

    @Test
    void 달성률을_비우면_컷라인만_계산한다() throws Exception {
        when(service.simulate(eq(USER), eq(10L), any())).thenReturn(Mockito.mock(RatingSimulationResponse.class));

        mvc.perform(get("/api/v1/skills/me/simulate").param("songDifficultyId", "10")).andExpect(status().isOk());

        verify(service).simulate(USER, 10L, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"-0.01", "100.01", "95.555", "abc"})
    void 범위를_벗어나거나_숫자가_아니거나_소수_셋째_자리면_400이고_계산하지_않는다(String rate) throws Exception {
        mvc.perform(get("/api/v1/skills/me/simulate").param("songDifficultyId", "10").param("achievement", rate))
                .andExpect(status().isBadRequest())
                // 공통 에러 형식이고, 변환 실패 같은 내부 메시지(클래스 이름 등)를 내보내지 않는다
                .andExpect(content().string(not(containsString("java."))));

        verify(service, never()).simulate(any(), any(), any());
    }

    @Test
    void 채보가_없으면_400이다() throws Exception {
        mvc.perform(get("/api/v1/skills/me/simulate").param("achievement", "90.00")).andExpect(status().isBadRequest());

        verify(service, never()).simulate(any(), any(), any());
    }
}
