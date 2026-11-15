package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.DashboardResponse.Dashboard;
import com.srpfreaks.backend.dto.DashboardResponse.RecordPoint;
import com.srpfreaks.backend.dto.DashboardResponse.SignupPoint;
import com.srpfreaks.backend.dto.DashboardResponse.Summary;
import com.srpfreaks.backend.dto.DashboardResponse.SuggestionStatusCount;
import com.srpfreaks.backend.dto.DashboardResponse.TierDistribution;
import com.srpfreaks.backend.dto.DashboardResponse.TierRow;
import com.srpfreaks.backend.entity.SuggestionStatus;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 관리자 대시보드(D80) 응답에는 개인이 드러나는 필드가 없다: 이메일·닉네임·유저 id·역할·Google ID와 개인 기록. 실수로 내보낼 수 없게 필드 자체가 없는지 본다.
 * 또 판정 라벨이 없다(숫자와 개수뿐).
 */
class DashboardResponseTest {

    private static List<String> fieldNames() {
        List<String> names = new ArrayList<>();
        for (Class<?> type : DashboardResponse.class.getDeclaredClasses()) {
            if (type.isRecord()) {
                for (RecordComponent component : type.getRecordComponents()) {
                    names.add(component.getName().toLowerCase(Locale.ROOT));
                }
            }
        }
        return names;
    }

    @Test
    void 응답_필드에_이메일_닉네임_유저_id_역할_Google_ID가_없다() {
        assertThat(fieldNames()).isNotEmpty();
        assertThat(fieldNames()).noneMatch(n -> n.contains("email") || n.contains("nickname") || n.contains("nick")
                || n.equals("userid") || n.equals("id") || n.contains("role") || n.contains("google") || n.equals("sub")
                || n.contains("name") && !n.equals("displayname"));
    }

    @Test
    void 응답_필드에_판정_라벨이_없다() {
        assertThat(fieldNames()).noneMatch(n -> n.contains("verdict") || n.contains("warning") || n.contains("alert")
                || n.contains("anomal") || n.contains("judg") || n.contains("label"));
    }

    @Test
    void JSON으로_내보내도_개인을_알_수_있는_키가_나오지_않는다() {
        JsonMapper mapper = JsonMapper.builder().build();
        Dashboard dashboard = new Dashboard(7, "Asia/Seoul", LocalDate.parse("2026-11-09"), LocalDate.parse("2026-11-15"),
                new Summary(50, 6, 20, new BigDecimal("40.0"), 7, 4, 3),
                List.of(new SignupPoint(LocalDate.parse("2026-11-15"), 3, 50)),
                List.of(new RecordPoint(LocalDate.parse("2026-11-15"), 7)),
                new TierDistribution("PUBLIC_PROFILES", 9, 4, List.of(new TierRow("gold", "Gold", 1000, 2))),
                List.of(new SuggestionStatusCount(SuggestionStatus.RECEIVED, 3)));

        String json = mapper.writeValueAsString(dashboard).toLowerCase(Locale.ROOT);

        assertThat(json).doesNotContain("email", "nickname", "googlesub", "google", "\"role\"", "userid", "@");
        assertThat(json).contains("\"zone\":\"asia/seoul\"", "\"basis\":\"public_profiles\"", "\"status\":\"received\"");
    }
}
