package com.srpfreaks.backend.security;

/** 구글 ID 토큰 검증. 구현을 갈아끼울 수 있게 인터페이스로 두어서, 서비스 테스트에서는 가짜로 대체한다. */
public interface GoogleTokenVerifier {

    /**
     * @return 검증을 통과한 구글 계정 정보
     * @throws com.srpfreaks.backend.common.error.ApiException 검증 실패(이유를 구분하지 않고 AUTH_FAILED)
     */
    GoogleIdentity verify(String idToken);
}
