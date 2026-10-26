package com.srpfreaks.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 모든 API 경로의 "로그인 없이 부르면 401" 점검 (기본 정책 deny all이 새 경로에도 지켜지는지).
 *
 * 어떻게: 스프링에 등록된 모든 컨트롤러 매핑(`/api/v1/**`)을 꺼내서, 토큰 없이 실제 서버(임의 포트)에 HTTP로 호출한다.
 * 공개 목록에 없는 (메서드, 경로)는 모두 401이어야 한다. 공개 목록은 두 곳이다:
 *  - 로그인·재발급·로그아웃 POST 세 개 (SecurityConfig)
 *  - 로그인 없이 읽는 GET (PublicReadPaths)
 * 왜 필요한가: 새 컨트롤러를 만들 때 SecurityConfig를 건드리지 않아도 `/api/v1/**`가 막혀 있어서 안전하지만,
 * 누군가 공개 규칙을 잘못 넓히거나(접두사로 열기 등) 새 경로가 그 규칙에 걸려 열리면 이 테스트가 바로 잡아 준다.
 * 경로의 `{id}` 같은 자리는 1로 채운다. 인증 단계에서 막히므로 실제 데이터가 있을 필요는 없다.
 * Docker가 필요하다. 비밀값은 다른 통합 테스트와 같은 테스트용 더미 값이다.
 */
@SpringBootTest(
		webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"spring.datasource.password=unused",
				"jwt.secret=test-only-secret-key-at-least-32-bytes-long",
				"app.google.client-id=test-client-id.apps.googleusercontent.com"
		})
@Testcontainers
class EndpointAuthSweepTest {

	/** SecurityConfig가 로그인 없이 열어 둔 POST 경로 (로그인 전에 불러야 하는 것들). */
	private static final Set<String> PUBLIC_POSTS = Set.of(
			"/api/v1/auth/google", "/api/v1/auth/refresh", "/api/v1/auth/logout");

	@Container
	@ServiceConnection
	static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

	@Value("${local.server.port}")
	int port;

	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	RequestMappingHandlerMapping handlerMapping;

	/** 점검할 (메서드, 경로) 목록. 메서드를 정하지 않은 매핑은 GET·POST 둘 다 본다. */
	private List<String[]> apiEndpoints() {
		Set<String> seen = new TreeSet<>();
		List<String[]> endpoints = new ArrayList<>();
		for (RequestMappingInfo info : handlerMapping.getHandlerMethods().keySet()) {
			Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
			List<String> methodNames = methods.isEmpty()
					? List.of("GET", "POST")
					: methods.stream().map(Enum::name).toList();
			for (String pattern : info.getPatternValues()) {
				if (!pattern.startsWith("/api/v1/")) {
					continue;
				}
				String uri = pattern.replaceAll("\\{[^}]+}", "1");
				for (String method : methodNames) {
					if (seen.add(method + " " + uri)) {
						endpoints.add(new String[] {method, uri});
					}
				}
			}
		}
		return endpoints;
	}

	private int statusOf(String method, String uri) throws Exception {
		HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + uri))
				.method(method, HttpRequest.BodyPublishers.noBody())
				.build();
		return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
	}

	private static boolean isPublic(String method, String uri) {
		return ("POST".equals(method) && PUBLIC_POSTS.contains(uri)) || PublicReadPaths.matches(method, uri);
	}

	@Test
	void 공개_목록에_없는_API_경로는_토큰_없이_부르면_모두_401이다() throws Exception {
		List<String[]> endpoints = apiEndpoints();
		// 경로를 하나도 못 찾았는데 통과해 버리는 일을 막는다(현재 수십 개). 컨트롤러가 크게 줄면 이 숫자를 함께 고친다.
		assertThat(endpoints.size()).isGreaterThan(30);

		List<String> notBlocked = new ArrayList<>();
		for (String[] endpoint : endpoints) {
			if (isPublic(endpoint[0], endpoint[1])) {
				continue;
			}
			int status = statusOf(endpoint[0], endpoint[1]);
			if (status != 401) {
				notBlocked.add(endpoint[0] + " " + endpoint[1] + " -> " + status);
			}
		}

		assertThat(notBlocked).as("로그인 없이 401이 아닌 응답을 준 경로").isEmpty();
	}

	@Test
	void 공개_GET_경로는_로그인_없이_401이나_403이_아니다() throws Exception {
		List<String> blocked = new ArrayList<>();
		int checked = 0;
		for (String[] endpoint : apiEndpoints()) {
			if (!"GET".equals(endpoint[0]) || !PublicReadPaths.matches(endpoint[0], endpoint[1])) {
				continue;
			}
			checked++;
			int status = statusOf(endpoint[0], endpoint[1]);
			// 데이터가 없어 404여도 괜찮다. 인증 때문에 막히면(401·403) 공개 목록과 실제 설정이 어긋난 것이다.
			if (status == 401 || status == 403) {
				blocked.add(endpoint[0] + " " + endpoint[1] + " -> " + status);
			}
		}

		assertThat(checked).as("점검한 공개 GET 경로 수").isGreaterThan(5);
		assertThat(blocked).as("공개여야 하는데 막힌 경로").isEmpty();
	}
}
