package com.srpfreaks.backend.service.recognize;

import com.srpfreaks.backend.config.AppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Anthropic Claude API(Messages)로 결과 화면 사진을 읽는다(D55). 의존성을 늘리지 않으려고 JDK HttpClient를 쓴다.
 *
 * 왜 "도구(tool) 강제 호출"인가: 모델에게 답을 자유 글로 받으면 형식이 흔들린다. report_result라는 도구 하나를 주고
 * tool_choice로 반드시 그 도구를 부르게 하면, 응답의 tool_use.input이 아래 JSON 스키마 모양으로 온다.
 * 스키마에 플레이어 이름·ID 칸을 두지 않고, 프롬프트에서도 읽지 말라고 한다(개인정보를 응답에 싣지 않기 위해).
 *
 * 키(x-api-key)와 사진은 로그에 남기지 않는다. 오류 메시지에도 응답 본문을 넣지 않는다(상태 코드만).
 */
@Component
public class AnthropicVisionClient implements VisionClient {

    static final String TOOL_NAME = "report_result";
    private static final String API_VERSION = "2023-06-01";
    private static final String PROMPT = """
            This is a photo of a GITADORA (GuitarFreaks / DrumMania arcade game) GUITAR or BASS result screen.
            Call the report_result tool with what you can read. Use null for anything you cannot read with confidence.
            - title: the song title exactly as shown.
            - part: GUITAR or BASS. difficulty: BASIC, ADVANCED, EXTREME or MASTER. level: the chart level such as 9.75.
            - achievementRate: the achievement percentage such as 92.45 (MAX means 100.00).
            - missCount: the MISS count. fullCombo: true if FULL COMBO / EXCELLENT is shown or MISS is 0.
            - superRandomPlus: true only if the SUPER RANDOM+ (S-RANDOM+) option is shown, false if a different random option is shown.
            Do NOT read or report the player name, player ID, rival names, or any other personal information.
            """;

    private final AppProperties.Llm config;
    private final HttpClient http;
    private final JsonMapper json = JsonMapper.builder().build();

    /** 생성자가 둘이라(아래는 테스트용) 스프링이 쓸 생성자를 지정한다. */
    @Autowired
    public AnthropicVisionClient(AppProperties properties) {
        this(properties.getLlm(), HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    AnthropicVisionClient(AppProperties.Llm config, HttpClient http) {
        this.config = config;
        this.http = http;
    }

    @Override
    public boolean isConfigured() {
        return config.getApiKey() != null && !config.getApiKey().isBlank();
    }

    @Override
    public VisionResult read(byte[] image, String mediaType) {
        String body = json.writeValueAsString(requestBody(image, mediaType));
        HttpRequest request = HttpRequest.newBuilder(URI.create(config.getBaseUrl() + "/v1/messages"))
                .timeout(Duration.ofSeconds(config.getTimeoutSeconds()))
                .header("content-type", "application/json")
                .header("x-api-key", config.getApiKey())
                .header("anthropic-version", API_VERSION)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (java.io.IOException e) {
            throw new VisionException("인식 서비스에 연결하지 못했습니다");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new VisionException("인식이 중단됐습니다");
        }
        if (response.statusCode() != 200) {
            throw new VisionException("인식 서비스 응답 " + response.statusCode());
        }
        return parse(response.body());
    }

    Map<String, Object> requestBody(byte[] image, String mediaType) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", config.getModel());
        body.put("max_tokens", 400);
        body.put("tools", List.of(Map.of(
                "name", TOOL_NAME,
                "description", "Report the values read from the GITADORA result screen.",
                "input_schema", schema())));
        body.put("tool_choice", Map.of("type", "tool", "name", TOOL_NAME));
        body.put("messages", List.of(Map.of(
                "role", "user",
                "content", List.of(
                        Map.of("type", "image", "source", Map.of(
                                "type", "base64", "media_type", mediaType,
                                "data", Base64.getEncoder().encodeToString(image))),
                        Map.of("type", "text", "text", PROMPT)))));
        return body;
    }

    private static Map<String, Object> schema() {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("title", nullable("string"));
        props.put("part", Map.of("type", List.of("string", "null"), "enum", java.util.Arrays.asList("GUITAR", "BASS", null)));
        props.put("difficulty", Map.of("type", List.of("string", "null"),
                "enum", java.util.Arrays.asList("BASIC", "ADVANCED", "EXTREME", "MASTER", null)));
        props.put("level", nullable("string"));
        props.put("achievementRate", nullable("string"));
        props.put("missCount", nullable("integer"));
        props.put("fullCombo", nullable("boolean"));
        props.put("superRandomPlus", nullable("boolean"));
        return Map.of("type", "object", "properties", props,
                "required", List.of("title", "part", "difficulty", "level", "achievementRate", "missCount", "fullCombo", "superRandomPlus"));
    }

    private static Map<String, Object> nullable(String type) {
        return Map.of("type", List.of(type, "null"));
    }

    /** 응답의 content[] 중 type=tool_use, name=report_result 블록의 input을 읽는다. 없으면 형식 오류. */
    VisionResult parse(String responseBody) {
        JsonNode root;
        try {
            root = json.readTree(responseBody);
        } catch (RuntimeException e) {
            throw new VisionException("인식 결과를 읽지 못했습니다");
        }
        for (JsonNode block : root.path("content")) {
            if ("tool_use".equals(block.path("type").asString()) && TOOL_NAME.equals(block.path("name").asString())) {
                JsonNode in = block.path("input");
                return new VisionResult(text(in, "title"), text(in, "part"), text(in, "difficulty"), text(in, "level"),
                        text(in, "achievementRate"),
                        in.path("missCount").isIntegralNumber() ? in.path("missCount").asInt() : null,
                        in.path("fullCombo").isBoolean() ? in.path("fullCombo").asBoolean() : null,
                        in.path("superRandomPlus").isBoolean() ? in.path("superRandomPlus").asBoolean() : null);
            }
        }
        throw new VisionException("인식 결과 형식이 맞지 않습니다");
    }

    /** 글자 또는 숫자 칸을 글자로 읽는다(모델이 92.45를 숫자로 줄 때도 있다). null·빈 값은 null. */
    private static String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        if (v.isNull() || v.isMissingNode()) {
            return null;
        }
        String s = v.isNumber() ? v.asString() : v.asString().strip();
        return s.isEmpty() ? null : s;
    }
}
