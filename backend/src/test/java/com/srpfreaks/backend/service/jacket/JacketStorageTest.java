package com.srpfreaks.backend.service.jacket;

import com.srpfreaks.backend.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 재킷 파일 저장(D54): {songId}.webp로 저장·덮어쓰기·삭제, 임시 파일이 남지 않음. */
class JacketStorageTest {

    @TempDir
    Path dir;

    private JacketStorage storage(Path folder) {
        AppProperties properties = new AppProperties();
        properties.getJackets().setDir(folder.toString());
        return new JacketStorage(properties);
    }

    @Test
    void 곡_id_이름으로_저장하고_덮어쓴다() throws Exception {
        Path folder = dir.resolve("jackets"); // 아직 없는 폴더도 만든다
        JacketStorage storage = storage(folder);

        storage.save(12L, new byte[]{1, 2, 3});
        storage.save(12L, new byte[]{9});

        assertThat(Files.readAllBytes(folder.resolve("12.webp"))).containsExactly(9);
        try (var files = Files.list(folder)) {
            assertThat(files.map(p -> p.getFileName().toString())).containsExactly("12.webp");
        }
    }

    @Test
    void 저장한_파일은_다른_사용자도_읽을_수_있다() throws Exception {
        // 임시 파일 기본 권한(rw-------)으로 두면 nginx가 읽지 못해 403이 된다
        JacketStorage storage = storage(dir);
        storage.save(7L, new byte[]{1});
        assertThat(PosixFilePermissions.toString(Files.getPosixFilePermissions(dir.resolve("7.webp")))).isEqualTo("rw-r--r--");
    }

    @Test
    void 시작할_때_읽을_수_없는_예전_재킷_파일의_권한만_고친다() throws Exception {
        Path old = Files.writeString(dir.resolve("5.webp"), "x");
        Path other = Files.writeString(dir.resolve("notes.txt"), "x");
        Files.setPosixFilePermissions(old, PosixFilePermissions.fromString("rw-------"));
        Files.setPosixFilePermissions(other, PosixFilePermissions.fromString("rw-------"));

        storage(dir).fixPermissions();

        assertThat(PosixFilePermissions.toString(Files.getPosixFilePermissions(old))).isEqualTo("rw-r--r--");
        assertThat(PosixFilePermissions.toString(Files.getPosixFilePermissions(other))).isEqualTo("rw-------");
    }

    @Test
    void 지우면_파일이_없어지고_없는_파일을_지워도_오류가_아니다() {
        JacketStorage storage = storage(dir);
        storage.save(5L, new byte[]{1});

        storage.delete(5L);
        storage.delete(5L);

        assertThat(dir.resolve("5.webp")).doesNotExist();
    }

    @Test
    void 곡_id가_0_이하면_거절한다() {
        assertThatThrownBy(() -> storage(dir).save(0L, new byte[]{1})).isInstanceOf(IllegalArgumentException.class);
    }
}
