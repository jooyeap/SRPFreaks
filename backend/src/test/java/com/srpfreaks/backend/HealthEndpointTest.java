package com.srpfreaks.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 헬스체크 경로 검증. 실제 서버를 임의 포트로 띄워 HTTP로 호출한다 (보안 필터 체인까지 거쳐야 의미가 있어서).
 * - /actuator/health 는 로그인 없이 200, 본문은 상태만 (DB 상세 정보 같은 components 없음)
 * - 그 밖의 actuator 경로는 열려 있지 않다 (기본 정책 deny all 유지)
 * Docker가 필요하다. 접속 정보·비밀값은 BackendApplicationTests와 같은 테스트용 더미 값이다.
 */
@SpringBootTest(
		webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"spring.datasource.password=unused",
				"jwt.secret=test-only-secret-key-at-least-32-bytes-long",
				"app.google.client-id=test-client-id.apps.googleusercontent.com"
		})
@Testcontainers
class HealthEndpointTest {

	@Container
	@ServiceConnection
	static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

	@Value("${local.server.port}")
	int port;

	private HttpResponse<String> get(String path) throws Exception {
		HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build();
		return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
	}

	@Test
	void 헬스체크는_로그인없이_UP만_응답한다() throws Exception {
		HttpResponse<String> response = get("/actuator/health");

		assertThat(response.statusCode()).isEqualTo(200);
		assertThat(response.body()).contains("\"status\":\"UP\"");
		// show-details=never: DB 종류 같은 상세 정보가 새지 않는다
		assertThat(response.body()).doesNotContain("components").doesNotContain("mysql");
	}

	@Test
	void health_외_actuator_경로는_열려_있지_않다() throws Exception {
		assertThat(get("/actuator/env").statusCode()).isEqualTo(401);
		assertThat(get("/actuator/info").statusCode()).isEqualTo(401);
		assertThat(get("/actuator").statusCode()).isEqualTo(401);
	}
}
