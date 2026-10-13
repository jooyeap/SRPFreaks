package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.DifficultyCreateRequest;
import com.srpfreaks.backend.dto.DifficultyUpdateRequest;
import com.srpfreaks.backend.dto.SongRequest;
import com.srpfreaks.backend.dto.SongTitleRequest;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.entity.TitleKind;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 곡/채보 관리: 등록·수정·삭제, 중복 채보, 소프트 삭제 복원, 감사 로그. */
@ExtendWith(MockitoExtension.class)
class SongAdminServiceTest {

    private static final Long ACTOR = 7L;

    @Mock SongRepository songRepository;
    @Mock SongTitleRepository songTitleRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;
    @Mock SongQueryService songQueryService;

    SongAdminService service;
    User actor;

    @BeforeEach
    void setUp() {
        service = new SongAdminService(songRepository, songTitleRepository, songDifficultyRepository,
                auditLogRepository, userRepository, songQueryService);
        actor = User.create("sub-7", "admin@example.com", null, Role.ADMIN);
        // 404/409처럼 감사 로그까지 가지 않는 테스트도 있어서 strict 모드의 '사용 안 한 stub' 오류를 피한다
        lenient().when(userRepository.getReferenceById(ACTOR)).thenReturn(actor);
    }

    private Song song(long id) {
        Song song = Song.create("원래 곡명", null, "test", actor);
        ReflectionTestUtils.setField(song, "id", id);
        return song;
    }

    private SongRequest request(String title, List<SongTitleRequest> titles) {
        return new SongRequest(title, "  Artist ", null, "", 120, 180, "sheet-v1.1", titles);
    }

    private AuditLog savedAudit() {
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        return captor.getValue();
    }

    @SuppressWarnings("unchecked")
    private List<SongTitle> savedTitles() {
        ArgumentCaptor<Collection<SongTitle>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(songTitleRepository).saveAll(captor.capture());
        return List.copyOf(captor.getValue());
    }

    @Test
    void 곡을_등록하면_앞뒤_공백을_정리하고_빈_값은_null로_저장한다() {
        when(songRepository.save(any(Song.class))).thenAnswer(i -> {
            Song s = i.getArgument(0);
            ReflectionTestUtils.setField(s, "id", 1L);
            return s;
        });

        service.createSong(ACTOR, request("  새 곡  ", null));

        ArgumentCaptor<Song> captor = ArgumentCaptor.forClass(Song.class);
        verify(songRepository).save(captor.capture());
        Song saved = captor.getValue();
        assertThat(saved.getTitle()).isEqualTo("새 곡");
        assertThat(saved.getArtist()).isEqualTo("Artist");
        assertThat(saved.getTitleFolder()).isNull();
        assertThat(saved.getCreatedBy()).isSameAs(actor);
        assertThat(savedAudit().getAction()).isEqualTo("SONG_CREATE");
    }

    @Test
    void 같은_표기는_한_번만_저장한다() {
        when(songRepository.save(any(Song.class))).thenAnswer(i -> {
            Song s = i.getArgument(0);
            ReflectionTestUtils.setField(s, "id", 1L);
            return s;
        });

        service.createSong(ACTOR, request("새 곡", List.of(
                new SongTitleRequest(TitleKind.ROMAJI, "Neko Fantasia"),
                new SongTitleRequest(TitleKind.ROMAJI, " neko  fantasia "),   // 공백·대소문자만 다른 중복
                new SongTitleRequest(TitleKind.KO, "네코 판타지아"))));

        assertThat(savedTitles()).hasSize(2);
    }

    @Test
    void 곡_수정은_표기를_교체하고_titles가_null이면_표기를_건드리지_않는다() {
        Song song = song(1L);
        when(songRepository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(song));

        service.updateSong(ACTOR, 1L, request("바뀐 곡명", null));

        assertThat(song.getTitle()).isEqualTo("바뀐 곡명");
        verify(songTitleRepository, never()).deleteAllBySongId(any());
        assertThat(savedAudit().getAction()).isEqualTo("SONG_UPDATE");
    }

    @Test
    void 곡_수정에서_titles를_보내면_기존_표기를_지우고_다시_저장한다() {
        when(songRepository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(song(1L)));

        service.updateSong(ACTOR, 1L, request("바뀐 곡명", List.of(new SongTitleRequest(TitleKind.KO, "새 표기"))));

        verify(songTitleRepository).deleteAllBySongId(1L);
        assertThat(savedTitles()).hasSize(1);
    }

    @Test
    void 없는_곡을_수정하면_404다() {
        when(songRepository.findByIdAndDeletedFalse(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateSong(ACTOR, 5L, request("x", null)))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    void 곡_삭제는_소프트_삭제이고_감사_로그를_남긴다() {
        Song song = song(1L);
        when(songRepository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(song));

        service.deleteSong(ACTOR, 1L);

        assertThat(song.isDeleted()).isTrue();
        verify(songRepository, never()).delete(any(Song.class));
        AuditLog log = savedAudit();
        assertThat(log.getAction()).isEqualTo("SONG_DELETE");
        assertThat(log.getTargetId()).isEqualTo("1");
        assertThat(log.getActor()).isSameAs(actor);
    }

    // ---------------------------------------------------------------- 채보

    private DifficultyCreateRequest difficultyRequest() {
        return new DifficultyCreateRequest(InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"), 1200);
    }

    @Test
    void 채보를_등록한다() {
        when(songRepository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(song(1L)));
        when(songDifficultyRepository.findBySongIdAndInstrumentPartAndDifficultyType(1L, InstrumentPart.GUITAR,
                DifficultyType.MASTER)).thenReturn(Optional.empty());
        when(songDifficultyRepository.saveAndFlush(any(SongDifficulty.class))).thenAnswer(i -> i.getArgument(0));

        var response = service.createDifficulty(ACTOR, 1L, difficultyRequest());

        assertThat(response.level()).isEqualByComparingTo("9.50");
        assertThat(response.noteCount()).isEqualTo(1200);
        assertThat(savedAudit().getAction()).isEqualTo("DIFFICULTY_CREATE");
    }

    @Test
    void 이미_있는_채보를_또_등록하면_409다() {
        Song song = song(1L);
        when(songRepository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(song));
        when(songDifficultyRepository.findBySongIdAndInstrumentPartAndDifficultyType(any(), any(), any()))
                .thenReturn(Optional.of(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER,
                        new BigDecimal("9.00"))));

        assertThatThrownBy(() -> service.createDifficulty(ACTOR, 1L, difficultyRequest()))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 삭제된_채보와_같은_채보를_등록하면_새로_만들지_않고_되살린다() {
        Song song = song(1L);
        SongDifficulty deleted = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER,
                new BigDecimal("9.00"));
        deleted.delete();
        when(songRepository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(song));
        when(songDifficultyRepository.findBySongIdAndInstrumentPartAndDifficultyType(any(), any(), any()))
                .thenReturn(Optional.of(deleted));
        when(songDifficultyRepository.saveAndFlush(any(SongDifficulty.class))).thenAnswer(i -> i.getArgument(0));

        var response = service.createDifficulty(ACTOR, 1L, difficultyRequest());

        assertThat(deleted.isDeleted()).isFalse();
        assertThat(response.level()).isEqualByComparingTo("9.50");
    }

    @Test
    void 동시_등록으로_유니크_키가_걸리면_409로_바꾼다() {
        when(songRepository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(song(1L)));
        when(songDifficultyRepository.findBySongIdAndInstrumentPartAndDifficultyType(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(songDifficultyRepository.saveAndFlush(any(SongDifficulty.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> service.createDifficulty(ACTOR, 1L, difficultyRequest()))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
    }

    @Test
    void 채보_수정과_삭제() {
        Song song = song(1L);
        SongDifficulty difficulty = SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.EXTREME,
                new BigDecimal("8.00"));
        ReflectionTestUtils.setField(difficulty, "id", 3L);
        when(songDifficultyRepository.findByIdAndDeletedFalse(3L)).thenReturn(Optional.of(difficulty));

        service.updateDifficulty(ACTOR, 3L, new DifficultyUpdateRequest(new BigDecimal("8.25"), 900));
        assertThat(difficulty.getLevel()).isEqualByComparingTo("8.25");
        assertThat(difficulty.getNoteCount()).isEqualTo(900);

        service.deleteDifficulty(ACTOR, 3L);
        assertThat(difficulty.isDeleted()).isTrue();
    }

    @Test
    void 삭제된_곡에_딸린_채보는_수정할_수_없다() {
        Song song = song(1L);
        song.delete();
        SongDifficulty difficulty = SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.EXTREME,
                new BigDecimal("8.00"));
        when(songDifficultyRepository.findByIdAndDeletedFalse(3L)).thenReturn(Optional.of(difficulty));

        assertThatThrownBy(() -> service.updateDifficulty(ACTOR, 3L, new DifficultyUpdateRequest(new BigDecimal("8.25"), null)))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }
}
