package com.srpfreaks.backend.service.recognize;

import com.srpfreaks.backend.config.AppProperties;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Anthropic 호출 모양과 응답 해석을 확인한다. 진짜 API 대신 JDK 내장 HTTP 서버로 가짜 응답을 준다(키·비용 없음).
 */
class AnthropicVisionClientTest {

    HttpServer server;
    final AtomicReference<String> requestBody = new AtomicReference<>();
    final AtomicReference<String> apiKeyHeader = new AtomicReference<>();
    volatile int status = 200;
    volatile String responseBody = "";
    AnthropicVisionClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            apiKeyHeader.set(exchange.getRequestHeaders().getFirst("x-api-key"));
            byte[] out = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, out.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(out);
            }
        });
        server.start();
        AppProperties.Llm config = new AppProperties.Llm();
        config.setApiKey("test-key");
        config.setModel("claude-haiku-5-5");
        config.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        client = new AnthropicVisionClient(config, HttpClient.newHttpClient());
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void 도구를_강제로_부르게_요청하고_tool_use_입력을_읽는다() {
        responseBody = """
                {"content":[{"type":"text","text":"ok"},
                  {"type":"tool_use","name":"report_result","input":{
                    "title":"Step forward","part":"GUITAR","difficulty":"MASTER","level":"9.65",
                    "achievementRate":92.45,"missCount":3,"fullCombo":false,"randomOption":"S.RANDOM+"}}]}
                """;
        VisionResult r = client.read(new byte[]{1, 2, 3}, "image/jpeg");

        assertThat(r.title()).isEqualTo("Step forward");
        assertThat(r.part()).isEqualTo("GUITAR");
        assertThat(r.difficulty()).isEqualTo("MASTER");
        assertThat(r.level()).isEqualTo("9.65");
        assertThat(r.achievementRate()).isEqualTo("92.45");   // 숫자로 와도 글자로 읽는다
        assertThat(r.missCount()).isEqualTo(3);
        assertThat(r.fullCombo()).isFalse();
        assertThat(r.superRandomPlus()).isTrue();

        assertThat(apiKeyHeader.get()).isEqualTo("test-key");
        String body = requestBody.get();
        assertThat(body).contains("\"tool_choice\"").contains("\"type\":\"tool\"").contains("\"name\":\"report_result\"");   // Map 순서는 정해지지 않아 칸별로 본다
        assertThat(body).contains("\"model\":\"claude-haiku-5-5\"");
        assertThat(body).contains("\"data\":\"AQID\"");          // 사진은 base64로만 보낸다
        assertThat(body).doesNotContain("playerName");               // 플레이어 이름 칸을 묻지 않는다
        assertThat(body).contains("\"randomOption\"");             // 옵션은 칸 글자 그대로 받는다
    }

    @Test
    void 옵션_칸_글자로_SRN_플러스인지_정한다() {
        assertThat(AnthropicVisionClient.isSuperRandomPlus("S.RANDOM+")).isTrue();
        assertThat(AnthropicVisionClient.isSuperRandomPlus("S-RANDOM+")).isTrue();
        assertThat(AnthropicVisionClient.isSuperRandomPlus("s.random +")).isTrue();
        assertThat(AnthropicVisionClient.isSuperRandomPlus("SUPER RANDOM+")).isTrue();
        assertThat(AnthropicVisionClient.isSuperRandomPlus("S.RANDOM")).isFalse();   // +가 없으면 다른 옵션
        assertThat(AnthropicVisionClient.isSuperRandomPlus("RANDOM")).isFalse();
        assertThat(AnthropicVisionClient.isSuperRandomPlus("OFF")).isFalse();
        assertThat(AnthropicVisionClient.isSuperRandomPlus(null)).isNull();
        assertThat(AnthropicVisionClient.isSuperRandomPlus(" . ")).isNull();
    }

    @Test
    void 읽지_못한_칸은_null이다() {
        responseBody = """
                {"content":[{"type":"tool_use","name":"report_result","input":{
                  "title":null,"part":null,"difficulty":null,"level":null,"achievementRate":null,
                  "missCount":null,"fullCombo":null,"randomOption":null}}]}
                """;
        VisionResult r = client.read(new byte[]{1}, "image/png");
        assertThat(r).isEqualTo(new VisionResult(null, null, null, null, null, null, null, null));
    }

    @Test
    void 응답_코드가_200이_아니거나_도구_호출이_없으면_실패로_알린다() {
        status = 529;
        responseBody = "{\"error\":{\"message\":\"overloaded\"}}";
        assertThatThrownBy(() -> client.read(new byte[]{1}, "image/jpeg"))
                .isInstanceOf(VisionClient.VisionException.class)
                .hasMessageNotContaining("overloaded");   // 응답 본문을 메시지에 넣지 않는다

        status = 200;
        responseBody = "{\"content\":[{\"type\":\"text\",\"text\":\"hi\"}]}";
        assertThatThrownBy(() -> client.read(new byte[]{1}, "image/jpeg")).isInstanceOf(VisionClient.VisionException.class);
    }

    @Test
    void 키가_비어_있으면_설정되지_않은_것으로_본다() {
        AppProperties.Llm empty = new AppProperties.Llm();
        assertThat(new AnthropicVisionClient(empty, HttpClient.newHttpClient()).isConfigured()).isFalse();
        assertThat(client.isConfigured()).isTrue();
    }
}
