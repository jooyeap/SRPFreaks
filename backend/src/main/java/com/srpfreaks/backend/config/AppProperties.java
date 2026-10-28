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
    private final Llm llm = new Llm();

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
        /** 로그인(/auth/google) 요청을 IP당 1분에 허용하는 횟수. 무차별 대입을 늦추려고 작게 둔다. */
        private int authPerMinute = 10;
        /** 재발급(/auth/refresh)·로그아웃 요청을 IP당 1분에 허용하는 횟수. 화면을 열 때마다 불리고, 오락실 Wi-Fi처럼 한 IP를 여러 사람이 쓸 수 있어 넉넉하게 둔다. */
        private int refreshPerMinute = 60;
        /** 로그인 없이 읽는 공개 경로(공지·곡·서열표·유저 목록)를 비로그인 IP당 1분에 허용하는 횟수. 한 화면이 여러 번 부르고 공용 Wi-Fi도 있어 넉넉하게 둔다. 로그인한 사용자는 제한하지 않는다. */
        private int publicReadPerMinute = 120;
        /** 사진 인식(D55, /records/recognize) 요청을 IP당 1분에 허용하는 횟수. 주간 한도와 별개로 짧은 시간의 몰림만 막는다. */
        private int recognizePerMinute = 20;
    }

    /** 최근 플레이 가져오기(D40) 설정. */
    @Getter
    @Setter
    public static class ImportApi {
        /** true이면 모든 로그인 사용자가 사이트 화면용 가져오기(/record-imports)를 쓸 수 있다. false이면 ROOT만 가능하다(문제가 생겼을 때 되돌리는 스위치). 클래스 기본값은 false이고 application.yml이 true로 켠다. */
        private boolean enabled = false;
    }

    /** 사진 인식(D55)에 쓰는 외부 비전 모델(Anthropic Claude API). 키는 환경변수 LLM_API_KEY로만 받는다(저장소·로그에 남기지 않는다). */
    @Getter
    @Setter
    public static class Llm {
        /** 비어 있으면 인식을 하지 않는다("지금은 인식할 수 없습니다"). 사용량도 세지 않는다. */
        private String apiKey = "";
        /** 모델 이름. 가볍고 싼 Haiku급을 기본으로 쓴다. */
        private String model = "claude-haiku-5-5";
        private String baseUrl = "https://api.anthropic.com";
        /** 한 번 호출의 최대 대기 시간(초). */
        private int timeoutSeconds = 30;
    }
}
