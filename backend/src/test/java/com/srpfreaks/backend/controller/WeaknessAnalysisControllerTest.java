package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.WeaknessAnalysisResponse;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.WeaknessAnalysisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 약점 분석 API의 요청 처리: 사용자 id는 토큰(principal)에서만 쓰고 요청 값은 받지 않는다.
 * 인증 자체(로그인 없이 부르면 401)는 EndpointAuthSweepTest(Testcontainers)가 모든 /api/v1 경로에 대해 점검한다.
 * 다른 사람의 데이터를 부르는 경로가 없다(경로가 /me이고 id를 받는 파라미터가 없다).
 */
class WeaknessAnalysisControllerTest {

    private static final long USER = 7L;

    private final WeaknessAnalysisService service = Mockito.mock(WeaknessAnalysisService.class);
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
        mvc = MockMvcBuilders.standaloneSetup(new WeaknessAnalysisController(service))
                .setCustomArgumentResolvers(principal)
                .build();
    }

    @Test
    void 토큰의_본인_id로만_분석하고_응답에_유저_식별_정보가_없다() throws Exception {
        when(service.analyze(USER)).thenReturn(new WeaknessAnalysisResponse("SS 3", 6, 5, true, 3, new BigDecimal("0.5"),
                List.of(), List.of(), null, List.of()));

        // 다른 사람 id를 쿼리로 보내도 무시된다(파라미터가 없다)
        mvc.perform(get("/api/v1/skills/me/weakness").param("userId", "99"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tierName").value("SS 3"))
                .andExpect(jsonPath("$.peerAvailable").value(true))
                .andExpect(jsonPath("$.userId").doesNotExist())
                .andExpect(jsonPath("$.nickname").doesNotExist());

        verify(service).analyze(USER);
    }
}
