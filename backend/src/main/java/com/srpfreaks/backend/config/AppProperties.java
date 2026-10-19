package com.srpfreaks.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * 서비스 설정 (application.yml의 app.*). 비밀값과 환경별 값은 모두 환경변수로 주입한다.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Google google = new Google();
    private final Cors cors = new Cors();
    private final Cookie cookie = new Cookie();
    private final RateLimit rateLimit = new RateLimit();
    private final ImportApi importApi = new ImportApi();

    /**
     * 이 이메일로 처음 Google 로그인하는 계정만 ROOT가 된다(단, 아직 ROOT가 없을 때). 비워 두면 ROOT를 만들지 않는다.
     * 코드나 DB 시드에 계정 정보를 넣지 않고 환경변수(ROOT_EMAIL)로만 받는다.
     */
    private String rootEmail;

    @Getter
    @Setter
    public static class Google {
        /** Google ID 토큰의 aud(대상)로 검증하는 우리 클라이언트 ID. */
        private String clientId;
    }

    @Getter
    @Setter
    public static class Cors {
        /** 허용 Origin 화이트리스트. 와일드카드(*)는 쓰지 않는다. */
        private List<String> allowedOrigins = new ArrayList<>();
    }

    @Getter
    @Setter
    public static class Cookie {
        /** Refresh 쿠키의 Secure 속성. 운영(https)에서는 항상 true. */
        private boolean secure = true;
    }

    @Getter
    @Setter
    public static class RateLimit {
        /** 로그인/재발급/로그아웃 요청을 IP당 1분에 허용하는 횟수. */
        private int authPerMinute = 10;
        /** 가져오기 요청을 IP당 1분에 허용하는 횟수. 공식 페이지 한 장(5곡)이 한 요청이라 4장을 가져와도 4번이다. */
        private int importPerMinute = 20;
    }

    /** 가져오기 API(D34) 설정. 북마클릿이 공식 페이지에서 직접 부르므로 그 Origin만 따로 허용한다. */
    @Getter
    @Setter
    public static class ImportApi {
        /** true이면 모든 로그인 사용자가 가져오기 토큰을 발급할 수 있다. false(기본)이면 토큰 발급·조회·폐기는 ROOT만 가능하다(공식 페이지에서 동작을 확인하는 동안). */
        private boolean enabled = false;
        /** 가져오기 경로에만 허용하는 Origin(쿠키 없이). 기본은 공식 사이트 주소다. 와일드카드(*)는 쓰지 않는다. */
        private List<String> allowedOrigins = new ArrayList<>(List.of("https://p.eagate.573.jp"));
    }
}
