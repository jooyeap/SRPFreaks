package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.common.error.GlobalExceptionHandler;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.UserListAddItemResponse;
import com.srpfreaks.backend.dto.UserListSummaryResponse;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.UserListService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.Clock;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 내 리스트 API의 요청 처리: 사용자 id는 토큰(principal)에서만 쓰고, 상태 코드(201/200/204)와 오류 형식(400/404)을 확인한다.
 * 로그인 없이 부르면 401은 EndpointAuthSweepTest(Testcontainers)가 모든 /api/v1 경로에 대해 점검하고,
 * 공개 읽기 경로가 아니라는 것은 PublicReadPathsTest가 확인한다.
 */
class UserListControllerTest {

    private static final long USER = 7L;

    private final UserListService service = Mockito.mock(UserListService.class);
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
        mvc = MockMvcBuilders.standaloneSetup(new UserListController(service))
                .setCustomArgumentResolvers(principal)
                .setControllerAdvice(new GlobalExceptionHandler(Clock.systemUTC()))
                .build();
    }

    @Test
    void 목록은_토큰의_본인_id와_담김_조회용_채보로_부른다() throws Exception {
        when(service.list(USER, 12L, 0, 10)).thenReturn(new PageResponse<>(
                List.of(new UserListSummaryResponse(3L, "연습", 4, true)), 0, 10, 1, 1));

        MvcResult result = mvc.perform(get("/api/v1/me/lists").param("songDifficultyId", "12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("연습"))
                .andExpect(jsonPath("$.content[0].contains").value(true))
                .andReturn();

        // 응답에는 소유자의 이메일·역할·Google ID 같은 필드가 없다
        String body = result.getResponse().getContentAsString().toLowerCase();
        assertThat(body).doesNotContain("email", "role", "google", "userid");
        verify(service).list(USER, 12L, 0, 10);
    }

    @Test
    void 만들면_201과_만든_리스트를_돌려준다() throws Exception {
        when(service.create(USER, "연습")).thenReturn(new UserListSummaryResponse(3L, "연습", 0, null));

        mvc.perform(post("/api/v1/me/lists").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"연습\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(3));
    }

    @Test
    void 이름이_빠지면_400() throws Exception {
        mvc.perform(post("/api/v1/me/lists").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 중복_이름은_400과_안내_문구() throws Exception {
        when(service.create(USER, "연습")).thenThrow(new ApiException(ErrorCode.LIST_NAME_DUPLICATE));

        mvc.perform(post("/api/v1/me/lists").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"연습\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(ErrorCode.LIST_NAME_DUPLICATE.getMessage()));
    }

    @Test
    void 남의_리스트는_404() throws Exception {
        when(service.detail(USER, 99L, 0, 100)).thenThrow(new ApiException(ErrorCode.NOT_FOUND));
        mvc.perform(get("/api/v1/me/lists/99")).andExpect(status().isNotFound());
    }

    @Test
    void 이름을_바꾸고_지우면_본인_id로_부른다() throws Exception {
        when(service.rename(USER, 3L, "새 이름")).thenReturn(new UserListSummaryResponse(3L, "새 이름", 2, null));

        mvc.perform(patch("/api/v1/me/lists/3").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"새 이름\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("새 이름"));
        mvc.perform(delete("/api/v1/me/lists/3")).andExpect(status().isNoContent());
        verify(service).delete(USER, 3L);
    }

    @Test
    void 새로_담으면_201_이미_담겨_있으면_오류_없이_200() throws Exception {
        when(service.addItem(USER, 3L, 5L)).thenReturn(new UserListAddItemResponse(false, 1));
        when(service.addItem(USER, 3L, 6L)).thenReturn(new UserListAddItemResponse(true, 1));

        mvc.perform(post("/api/v1/me/lists/3/items").contentType(MediaType.APPLICATION_JSON).content("{\"songDifficultyId\":5}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.alreadyContained").value(false));
        mvc.perform(post("/api/v1/me/lists/3/items").contentType(MediaType.APPLICATION_JSON).content("{\"songDifficultyId\":6}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alreadyContained").value(true));
    }

    @Test
    void 곡_수_상한은_400() throws Exception {
        when(service.addItem(USER, 3L, 5L)).thenThrow(new ApiException(ErrorCode.LIST_ITEMS_LIMIT));
        mvc.perform(post("/api/v1/me/lists/3/items").contentType(MediaType.APPLICATION_JSON).content("{\"songDifficultyId\":5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(ErrorCode.LIST_ITEMS_LIMIT.getMessage()));
    }

    @Test
    void 빼기와_순서_바꾸기는_204() throws Exception {
        mvc.perform(delete("/api/v1/me/lists/3/items/5")).andExpect(status().isNoContent());
        mvc.perform(put("/api/v1/me/lists/3/items/order").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"songDifficultyIds\":[2,1]}"))
                .andExpect(status().isNoContent());
        verify(service).removeItem(USER, 3L, 5L);
        verify(service).reorder(USER, 3L, List.of(2L, 1L));
    }

    @Test
    void 순서_바꾸기에_순서가_빠지면_400() throws Exception {
        mvc.perform(put("/api/v1/me/lists/3/items/order").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }
}
