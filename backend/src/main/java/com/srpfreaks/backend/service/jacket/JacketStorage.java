package com.srpfreaks.backend.service.jacket;

import com.srpfreaks.backend.config.AppProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * 재킷 파일(D54)을 폴더에 {songId}.webp로 둔다. 파일 이름은 곡 id(숫자)로만 만들어서 요청 값이 경로에 들어가지 않는다.
 * 같은 폴더를 nginx가 읽기 전용으로 붙여 /jackets/{songId}.webp로 내보낸다(백엔드를 거치지 않는다).
 */
@Component
public class JacketStorage {

    private final Path dir;

    public JacketStorage(AppProperties properties) {
        this.dir = Path.of(properties.getJackets().getDir()).toAbsolutePath().normalize();
    }

    /** 임시 파일에 먼저 쓰고 옮겨서, nginx가 반쯤 쓴 파일을 내보내는 일이 없게 한다. */
    public void save(long songId, byte[] bytes) {
        try {
            Files.createDirectories(dir);
            Path tmp = Files.createTempFile(dir, "upload-", ".tmp");
            try {
                Files.write(tmp, bytes);
                Files.move(tmp, fileOf(songId), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("재킷 파일을 저장하지 못했습니다.", e);
        }
    }

    /** 파일이 없어도 오류가 아니다(이미 지운 경우). */
    public void delete(long songId) {
        try {
            Files.deleteIfExists(fileOf(songId));
        } catch (IOException e) {
            throw new UncheckedIOException("재킷 파일을 지우지 못했습니다.", e);
        }
    }

    Path fileOf(long songId) {
        if (songId <= 0) {
            throw new IllegalArgumentException("곡 id가 올바르지 않습니다.");
        }
        return dir.resolve(songId + ".webp");
    }
}
