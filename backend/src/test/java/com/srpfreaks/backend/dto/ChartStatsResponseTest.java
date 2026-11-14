package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.ChartStatsResponse.Chart;
import com.srpfreaks.backend.dto.ChartStatsResponse.DeviationRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.Meta;
import com.srpfreaks.backend.dto.ChartStatsResponse.Page;
import com.srpfreaks.backend.dto.ChartStatsResponse.PlayerRow;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 서열표 분석(D77) 응답에는 이메일·역할·Google ID와 판정 라벨이 필드로 없다. 실수로 내보낼 수 없게 필드 자체가 없는지 본다.
 */
class ChartStatsResponseTest {

    private static List<String> fieldNames() {
        List<String> names = new ArrayList<>();
        for (Class<?> type : ChartStatsResponse.class.getDeclaredClasses()) {
            if (type.isRecord()) {
                for (RecordComponent component : type.getRecordComponents()) {
                    names.add(component.getName().toLowerCase(Locale.ROOT));
                }
            }
        }
        return names;
    }

    @Test
    void 응답_필드에_이메일_역할_Google_ID가_없다() {
        assertThat(fieldNames()).isNotEmpty();
        assertThat(fieldNames()).noneMatch(n -> n.contains("email") || n.contains("role") || n.contains("google") || n.contains("sub"));
    }

    @Test
    void 응답_필드에_판정_라벨이_없다() {
        // 숫자·순서만 있다: 후보, 역전, 적정, 경고, 쉬움, 어려움 같은 판정 이름의 필드를 만들지 않는다
        assertThat(fieldNames()).noneMatch(n -> n.contains("candidate") || n.contains("reversal") || n.contains("verdict")
                || n.contains("warning") || n.contains("easy") || n.contains("hard") || n.contains("label") || n.contains("judg"));
    }

    @Test
    void 유저_줄을_JSON으로_내보내도_이메일_역할_Google_ID가_나오지_않는다() {
        JsonMapper mapper = JsonMapper.builder().build();
        PlayerRow row = new PlayerRow(10L, "nick10", new PlayerTierResponse("gold", "Gold", 100, null, null), new BigDecimal("123.45"),
                new BigDecimal("93.46"), 4, Instant.parse("2026-11-10T03:00:00Z"));
        Chart chart = new Chart(1L, 2L, "곡", InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"), new BigDecimal("6.0"));
        DeviationRow deviation = new DeviationRow(chart, 3, 5, new BigDecimal("95.00"), new BigDecimal("80.00"), new BigDecimal("15.00"), 3);

        String json = mapper.writeValueAsString(new Page<>(List.of(row), 0, 20, 1, 1, new Meta(12, 3, 3, 7)))
                + mapper.writeValueAsString(deviation);

        assertThat(json).doesNotContain("email", "role", "google", "@example.com");
        assertThat(json).contains("\"nickname\":\"nick10\"", "\"totalScore\":123.45", "\"lastPlayedAt\":\"2026-11-10T03:00:00Z\"");
    }
}
