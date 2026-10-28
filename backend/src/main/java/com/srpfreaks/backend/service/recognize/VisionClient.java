package com.srpfreaks.backend.service.recognize;

/** 사진을 읽는 외부 비전 모델. 테스트에서는 가짜로 바꾼다. */
public interface VisionClient {

    /** 키가 설정돼 있어 호출할 수 있는가. 없으면 인식하지 않고 사용량도 세지 않는다. */
    boolean isConfigured();

    /**
     * 사진 한 장을 읽는다. 실패(네트워크·응답 형식)는 VisionException으로 알린다.
     * 사진 바이트는 이 호출 동안만 메모리에 있고 어디에도 남기지 않는다.
     */
    VisionResult read(byte[] image, String mediaType);

    class VisionException extends RuntimeException {
        public VisionException(String message) {
            super(message);
        }
    }
}
