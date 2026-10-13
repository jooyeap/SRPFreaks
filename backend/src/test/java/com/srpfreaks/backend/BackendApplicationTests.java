package com.srpfreaks.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

/**
 * 애플리케이션 전체가 실제로 기동되는지 확인한다 (Flyway 적용 + ddl-auto=validate + 보안 설정 + 빈 연결).
 * - 환경변수(DB_PASSWORD, JWT_SECRET, GOOGLE_CLIENT_ID) 없이도 돌도록 테스트용 더미 값을 넣는다. 실제 비밀값이 아니다.
 * - DB는 로컬 Docker 대신 Testcontainers MySQL을 쓴다 (접속 정보는 @ServiceConnection이 준다). Docker가 필요하다.
 */
@SpringBootTest(properties = {
		"spring.datasource.password=unused",
		"jwt.secret=test-only-secret-key-at-least-32-bytes-long",
		"app.google.client-id=test-client-id.apps.googleusercontent.com"
})
@Testcontainers
class BackendApplicationTests {

	@Container
	@ServiceConnection
	static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

	@Test
	void contextLoads() {
	}

}
