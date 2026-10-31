package com.srpfreaks.backend.service.jacket;

import com.srpfreaks.backend.config.AppProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

/**
 * 재킷 파일(D54)을 폴더에 {songId}.webp로 둔다. 파일 이름은 곡 id(숫자)로만 만들어서 요청 값이 경로에 들어가지 않는다.
 * 같은 폴더를 nginx가 읽기 전용으로 붙여 /jackets/{songId}.webp로 내보낸다(백엔드를 거치지 않는다).
 */
@Slf4j
@Component
public class JacketStorage {

    private final Path dir;

    /**
     * 파일 권한 rw-r--r--. 임시 파일(createTempFile)은 기본이 rw-------(나만 읽기)라서 그대로 옮기면 nginx(다른 사용자)가 읽지 못해
     * /jackets/{id}.webp가 403이 된다(2026-11-01 첫 배포에서 실제로 생김). 그래서 옮기기 전에 다른 사용자도 읽을 수 있게 바꾼다.
     */
    static final Set<PosixFilePermission> FILE_PERMISSIONS = PosixFilePermissions.fromString("rw-r--r--");

    public JacketStorage(AppProperties properties) {
        this.dir = Path.of(properties.getJackets().getDir()).toAbsolutePath().normalize();
    }

    /**
     * 시작할 때 한 번: 이미 저장된 재킷 중 다른 사용자가 읽을 수 없는 파일의 권한을 고친다(권한 문제 이전에 저장한 파일용).
     * 실패해도 서버 시작은 막지 않는다(재킷이 안 보일 뿐이다). 파일 이름이 {숫자}.webp인 것만 본다.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void fixPermissions() {
        if (!Files.isDirectory(dir)) {
            return;
        }
        try (Stream<Path> files = Files.list(dir)) {
            files.filter(f -> f.getFileName().toString().matches("\\d+\\.webp")).forEach(JacketStorage::makeReadable);
        } catch (IOException | UnsupportedOperationException e) {
            log.warn("재킷 파일 권한 확인 실패: {}", e.getClass().getSimpleName());
        }
    }

    private static void makeReadable(Path file) {
        try {
            Files.setPosixFilePermissions(file, FILE_PERMISSIONS);
        } catch (IOException | UnsupportedOperationException e) {
            log.warn("재킷 파일 권한 변경 실패: {}", e.getClass().getSimpleName());
        }
    }

    /** 임시 파일에 먼저 쓰고 옮겨서, nginx가 반쯤 쓴 파일을 내보내는 일이 없게 한다. */
    public void save(long songId, byte[] bytes) {
        try {
            Files.createDirectories(dir);
            Path tmp = Files.createTempFile(dir, "upload-", ".tmp");
            try {
                Files.write(tmp, bytes);
                makeReadable(tmp);
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
