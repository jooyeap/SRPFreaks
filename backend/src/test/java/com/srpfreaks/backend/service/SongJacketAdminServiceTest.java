package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SongJacketMatchResponse;
import com.srpfreaks.backend.dto.SongJacketSaveResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.service.jacket.JacketStorage;
import com.srpfreaks.backend.service.jacket.WebpFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 재킷 가져오기(D54): 곡명 매칭 규칙, 형식·크기 검사, 저장 주소, 감사 로그, 내리기. */
@ExtendWith(MockitoExtension.class)
class SongJacketAdminServiceTest {

    private static final Long ACTOR = 1L;

    @Mock SongRepository songRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;
    @Mock JacketStorage storage;

    SongJacketAdminService service;
    User root;
    final List<Song> songs = new ArrayList<>();
    final List<SongRepository.SongText> aliases = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new SongJacketAdminService(songRepository, auditLogRepository, userRepository, storage);
        root = User.create("sub-1", "root@example.com", null, Role.ROOT);
        lenient().when(userRepository.getReferenceById(ACTOR)).thenReturn(root);
        lenient().when(songRepository.findAll()).thenAnswer(inv -> songs);
        lenient().when(songRepository.findAllTitles()).thenAnswer(inv -> songs.stream()
                .filter(s -> !s.isDeleted()).map(s -> new SongRepository.SongText(s.getId(), s.getTitle())).toList());
        lenient().when(songRepository.findAllAliasTitles()).thenAnswer(inv -> aliases);
        lenient().when(songRepository.findByIdAndDeletedFalse(anyLong())).thenAnswer(inv -> songs.stream()
                .filter(s -> s.getId().equals(inv.getArgument(0)) && !s.isDeleted()).findFirst());
    }

    private Song song(long id, String title) {
        Song song = Song.create(title, null, "test", root);
        ReflectionTestUtils.setField(song, "id", id);
        songs.add(song);
        return song;
    }

    // ---------------------------------------------------------------- 매칭

    @Test
    void 정규화한_곡명과_별칭으로_맞추고_못_찾은_마스터_곡을_알려_준다() {
        song(1L, "Far East Nightbird");
        Song withJacket = song(2L, "KAISER PHOENIX");
        withJacket.changeImageUrl("/jackets/2.webp?v=abcd1234");
        song(3L, "眠りの国のステラ");
        aliases.add(new SongRepository.SongText(3L, "Nemuri no Kuni no Stella"));
        song(4L, "공식에 없는 곡");

        SongJacketMatchResponse result = service.match(List.of(
                "far east  nightbird", "KAISER PHOENIX", "Nemuri no Kuni no Stella", "공식에만 있는 곡"));

        assertThat(result.matches()).extracting(SongJacketMatchResponse.Match::songId).containsExactly(1L, 2L, 3L);
        assertThat(result.matches()).extracting(SongJacketMatchResponse.Match::hasJacket).containsExactly(false, true, false);
        assertThat(result.matches().get(0).officialTitle()).isEqualTo("far east  nightbird");
        assertThat(result.unmatchedCount()).isEqualTo(1);
        assertThat(result.missingSongs()).extracting(SongJacketMatchResponse.MissingSong::songId).containsExactly(4L);
    }

    @Test
    void 마스터에_같은_이름이_둘이면_맞추지_않는다() {
        song(1L, "Same");
        song(2L, "Same");

        SongJacketMatchResponse result = service.match(List.of("Same"));

        assertThat(result.matches()).isEmpty();
        assertThat(result.unmatchedCount()).isEqualTo(1);
        assertThat(result.missingSongs()).hasSize(2);
    }

    @Test
    void 공식_줄_두_개가_한_곡에_맞으면_처음_것만_쓴다() {
        song(1L, "Stella");
        aliases.add(new SongRepository.SongText(1L, "ステラ"));

        SongJacketMatchResponse result = service.match(List.of("Stella", "ステラ", "stella"));

        assertThat(result.matches()).hasSize(1);
        assertThat(result.unmatchedCount()).isEqualTo(1); // "stella"는 같은 곡명이라 한 번만 센다
    }

    @Test
    void 삭제된_곡은_맞추지도_못_찾은_곡에_넣지도_않는다() {
        Song deleted = song(1L, "Gone");
        ReflectionTestUtils.setField(deleted, "deleted", true);

        SongJacketMatchResponse result = service.match(List.of("Gone"));

        assertThat(result.matches()).isEmpty();
        assertThat(result.missingSongs()).isEmpty();
    }

    // ---------------------------------------------------------------- 저장

    @Test
    void 저장하면_파일을_쓰고_내용_해시가_붙은_주소를_넣고_감사_로그를_남긴다() {
        Song a = song(10L, "A");
        Song b = song(11L, "B");
        b.changeImageUrl("/jackets/11.webp?v=00000000");
        byte[] imageA = WebpFixtures.vp8(200, 200, 100);
        byte[] imageB = WebpFixtures.vp8(200, 200, 200);

        SongJacketSaveResponse result = service.save(ACTOR, List.of(10L, 11L), List.of(imageA, imageB));

        assertThat(result).isEqualTo(new SongJacketSaveResponse(1, 1));
        verify(storage).save(10L, imageA);
        verify(storage).save(11L, imageB);
        assertThat(a.getImageUrl()).isEqualTo("/jackets/10.webp?v=" + SongJacketAdminService.shortHash(imageA));
        assertThat(b.getImageUrl()).matches("/jackets/11\\.webp\\?v=[0-9a-f]{8}").isNotEqualTo("/jackets/11.webp?v=00000000");

        ArgumentCaptor<AuditLog> log = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(log.capture());
        assertThat(log.getValue().getAction()).isEqualTo("SONG_JACKET_IMPORT");
        assertThat(log.getValue().getDetail()).isEqualTo(Map.of("count", 2, "replaced", 1, "songIds", List.of(10L, 11L)));
    }

    @Test
    void 형식이_틀린_이미지가_하나라도_있으면_아무것도_저장하지_않는다() {
        song(10L, "A");
        song(11L, "B");
        byte[] jpeg = new byte[100];
        jpeg[0] = (byte) 0xff; jpeg[1] = (byte) 0xd8;

        assertThatThrownBy(() -> service.save(ACTOR, List.of(10L, 11L), List.of(WebpFixtures.vp8(200, 200, 0), jpeg)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode()).isEqualTo(ErrorCode.JACKET_BAD_IMAGE);
        verify(storage, never()).save(anyLong(), any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 크기와_가로세로_한도를_넘으면_거절한다() {
        assertThat(SongJacketAdminService.isAcceptable(WebpFixtures.vp8(256, 256, 0))).isTrue();
        assertThat(SongJacketAdminService.isAcceptable(WebpFixtures.vp8(257, 200, 0))).isFalse();
        assertThat(SongJacketAdminService.isAcceptable(WebpFixtures.vp8x(384, 384))).isFalse(); // 원본 크기 그대로
        assertThat(SongJacketAdminService.isAcceptable(WebpFixtures.vp8(200, 200, 50 * 1024))).isFalse(); // 50KB 초과
    }

    @Test
    void 곡_id와_이미지_개수가_다르거나_10장을_넘거나_같은_곡이_두_번이면_거절한다() {
        byte[] ok = WebpFixtures.vp8(200, 200, 0);

        assertThatThrownBy(() -> service.save(ACTOR, List.of(1L, 2L), List.of(ok))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.save(ACTOR, List.of(1L, 1L), List.of(ok, ok))).isInstanceOf(ApiException.class);
        List<Long> eleven = new ArrayList<>();
        for (long i = 1; i <= 11; i++) {
            eleven.add(i);
        }
        assertThatThrownBy(() -> service.save(ACTOR, eleven, Collections.nCopies(11, ok))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.save(ACTOR, List.of(), List.of())).isInstanceOf(ApiException.class);
    }

    @Test
    void 없거나_삭제된_곡이면_404이고_파일을_쓰지_않는다() {
        song(10L, "A");

        assertThatThrownBy(() -> service.save(ACTOR, List.of(10L, 99L), List.of(WebpFixtures.vp8(200, 200, 0), WebpFixtures.vp8(200, 200, 0))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
        verify(storage, never()).save(anyLong(), any());
    }

    // ---------------------------------------------------------------- 내리기

    @Test
    void 내리면_파일과_주소를_지우고_감사_로그를_남긴다() {
        Song a = song(10L, "A");
        a.changeImageUrl("/jackets/10.webp?v=abcd1234");

        service.delete(ACTOR, 10L);

        verify(storage).delete(10L);
        assertThat(a.getImageUrl()).isNull();
        ArgumentCaptor<AuditLog> log = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(log.capture());
        assertThat(log.getValue().getAction()).isEqualTo("SONG_JACKET_DELETE");
        assertThat(log.getValue().getTargetId()).isEqualTo("10");
    }

    @Test
    void 재킷이_없는_곡을_내리면_감사_로그를_남기지_않는다() {
        song(10L, "A");

        service.delete(ACTOR, 10L);

        verify(storage).delete(10L);
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 없는_곡을_내리면_404() {
        when(songRepository.findByIdAndDeletedFalse(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(ACTOR, 99L)).isInstanceOf(ApiException.class);
    }
}
