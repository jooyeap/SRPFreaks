package com.srpfreaks.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 운영 프로파일(application-prod.yml)에 안전 설정이 들어 있는지 확인한다. 앱을 띄우지 않고 파일만 읽는다.
 * 이 값들이 실수로 지워지거나 바뀌면 운영에서 쿠키가 평문으로 가거나 SQL·API 문서가 노출된다.
 */
class ProdProfileConfigTest {

    private PropertySource<?> prod() throws IOException {
        List<PropertySource<?>> sources =
                new YamlPropertySourceLoader().load("prod", new ClassPathResource("application-prod.yml"));
        return sources.get(0);
    }

    @Test
    void 쿠키_Secure는_환경변수와_상관없이_true로_고정된다() throws IOException {
        assertThat(prod().getProperty("app.cookie.secure")).isEqualTo(true);
    }

    @Test
    void API_문서는_꺼져_있다() throws IOException {
        assertThat(prod().getProperty("springdoc.api-docs.enabled")).isEqualTo(false);
        assertThat(prod().getProperty("springdoc.swagger-ui.enabled")).isEqualTo(false);
    }

    @Test
    void SQL_로그는_운영에서_꺼져_있다() throws IOException {
        assertThat(prod().getProperty("logging.level.org.hibernate.SQL")).isEqualTo("warn");
    }

    @Test
    void 에러_응답에_스택트레이스와_메시지를_싣지_않는다() throws IOException {
        assertThat(prod().getProperty("server.error.include-stacktrace")).isEqualTo("never");
        assertThat(prod().getProperty("server.error.include-message")).isEqualTo("never");
    }

    @Test
    void DB_접속정보는_환경변수로_받고_비밀번호는_파일에_없다() throws IOException {
        assertThat(prod().getProperty("spring.datasource.url").toString()).contains("${DB_HOST:db}");
        assertThat(prod().getProperty("spring.datasource.username")).isEqualTo("${DB_USER:srpfreaks}");
        // 비밀번호는 기본 파일의 ${DB_PASSWORD}를 그대로 쓰고, prod 파일에서는 정의하지 않는다
        assertThat(prod().getProperty("spring.datasource.password")).isNull();
    }
}
