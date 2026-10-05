package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** CSV 업로드 공통 검사. 파일 이름과 Content-Type은 사용자가 마음대로 보낼 수 있어 믿지 않고, 내용만 서비스에서 검증한다. */
final class CsvUploads {

    /** 시드(465곡·669채보)가 약 50KB라 여유를 두고 2MB로 제한한다. 서버 설정(multipart)에도 같은 상한을 둔다. */
    static final long MAX_FILE_BYTES = 2L * 1024 * 1024;

    private CsvUploads() {
    }

    static byte[] read(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty() || file.getSize() > MAX_FILE_BYTES) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        return file.getBytes();
    }
}
