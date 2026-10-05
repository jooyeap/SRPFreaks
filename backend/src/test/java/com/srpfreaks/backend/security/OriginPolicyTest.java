package com.srpfreaks.backend.security;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OriginPolicyTest {

    private OriginPolicy policy() {
        AppProperties props = new AppProperties();
        props.getCors().setAllowedOrigins(List.of("https://srpfreaks.example"));
        return new OriginPolicy(props);
    }

    private MockHttpServletRequest withOrigin(String origin) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/refresh");
        if (origin != null) {
            request.addHeader("Origin", origin);
        }
        return request;
    }

    @Test
    void 허용한_Origin은_통과한다() {
        assertThatCode(() -> policy().requireAllowed(withOrigin("https://srpfreaks.example"))).doesNotThrowAnyException();
    }

    @Test
    void 다른_Origin은_거부한다() {
        assertThatThrownBy(() -> policy().requireAllowed(withOrigin("https://evil.example")))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ORIGIN_NOT_ALLOWED));
    }

    @Test
    void Origin_헤더가_없으면_거부한다() {
        assertThatThrownBy(() -> policy().requireAllowed(withOrigin(null))).isInstanceOf(ApiException.class);
    }

    @Test
    void 접두사만_같은_Origin은_거부한다() {
        assertThatThrownBy(() -> policy().requireAllowed(withOrigin("https://srpfreaks.example.evil.com")))
                .isInstanceOf(ApiException.class);
    }
}
