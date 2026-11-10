package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RivalRegistrantResponse;
import com.srpfreaks.backend.dto.RivalSummaryDetailResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RivalService;
import com.srpfreaks.backend.service.RivalSummaryService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** "나를 등록한 유저" API(D63): 토큰의 본인 id로만 조회하고, 응답에 이메일·역할·Google ID가 없다. */
class RivalControllerTest {

    private final RivalService service = Mockito.mock(RivalService.class);
    private final RivalController controller = new RivalController(service, Mockito.mock(RivalSummaryService.class));

    @Test
    void 토큰의_사용자_id로_조회한다() {
        PageResponse<RivalRegistrantResponse> expected = new PageResponse<>(List.of(), 0, 20, 0, 0);
        Mockito.when(service.registeredMe(7L, 1, 20)).thenReturn(expected);

        assertThat(controller.registeredMe(new AuthenticatedUser(7L, Role.USER), 1, 20)).isSameAs(expected);
    }

    @Test
    void 다른_유저를_지정하는_입구가_없다() {
        Method method = Arrays.stream(RivalController.class.getDeclaredMethods())
                .filter(m -> m.getName().equals("registeredMe")).findFirst().orElseThrow();

        // 받는 값은 로그인 사용자, page, size뿐이다 (userId 같은 파라미터 없음)
        assertThat(method.getParameterTypes()).containsExactly(AuthenticatedUser.class, int.class, int.class);
    }

    @Test
    void 대시보드_집계는_토큰의_본인_id와_경로의_상대_id로만_부른다() {
        RivalSummaryService summaryService = Mockito.mock(RivalSummaryService.class);
        RivalController withSummary = new RivalController(service, summaryService);
        AuthenticatedUser me = new AuthenticatedUser(7L, Role.USER);

        withSummary.compareSummary(me, 9L);
        withSummary.compareSummaryDetail(me, 9L, "TRIPLE", "LOSE", "DIFF_ASC", 1, 20);

        Mockito.verify(summaryService).summary(7L, 9L);
        Mockito.verify(summaryService).detail(7L, 9L, "TRIPLE", "LOSE", "DIFF_ASC", 1, 20);
    }

    @Test
    void 대시보드_응답_키에_이메일_역할_google_id가_없다() {
        for (Class<?> type : new Class<?>[]{RivalSummaryResponse.class, RivalSummaryResponse.Totals.class,
                RivalSummaryResponse.PatternSummary.class, RivalSummaryResponse.TierSummary.class,
                RivalSummaryResponse.PatternDiffs.class, RivalSummaryDetailResponse.class, RivalSummaryDetailResponse.Row.class}) {
            assertThat(Arrays.stream(type.getRecordComponents()).map(c -> c.getName().toLowerCase()).collect(Collectors.toSet()))
                    .noneMatch(n -> n.contains("email") || n.contains("role") || n.contains("googlesub"));
        }
    }

    @Test
    void 응답_키에_이메일_역할_google_id가_없다() throws Exception {
        PageResponse<RivalRegistrantResponse> page = new PageResponse<>(
                List.of(new RivalRegistrantResponse(2L, "Rumi", new PlayerTierResponse("SS 3", "SS 3", 0, null, null), true)),
                0, 20, 1, 1);

        JsonNode json = JsonMapper.builder().build().valueToTree(page);

        Set<String> keys = new java.util.TreeSet<>();
        json.get("content").get(0).propertyNames().forEach(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("userId", "nickname", "tier", "mutual");
        assertThat(Arrays.stream(RivalRegistrantResponse.class.getRecordComponents())
                .map(c -> c.getName().toLowerCase()).collect(Collectors.toSet()))
                .noneMatch(n -> n.contains("email") || n.contains("role") || n.contains("googlesub"));
    }
}
