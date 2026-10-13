package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.DifficultyCreateRequest;
import com.srpfreaks.backend.dto.DifficultyResponse;
import com.srpfreaks.backend.dto.DifficultyUpdateRequest;
import com.srpfreaks.backend.dto.SongDetailResponse;
import com.srpfreaks.backend.dto.SongRequest;
import com.srpfreaks.backend.dto.SongTitleRequest;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 곡/채보 관리(등록·수정·삭제). ROOT·ADMIN만 호출할 수 있고(컨트롤러의 @PreAuthorize),
 * 모든 변경은 audit_logs에 남긴다. 삭제는 소프트 삭제라 기록(option_records)이 끊기지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SongAdminService {

    private final SongRepository songRepository;
    private final SongTitleRepository songTitleRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final SongQueryService songQueryService;

    // ---------------------------------------------------------------- 곡

    public SongDetailResponse createSong(Long actorId, SongRequest request) {
        Song song = Song.create(request.title().strip(), blankToNull(request.artist()),
                blankToNull(request.source()), userRepository.getReferenceById(actorId));
        song.changeMeta(blankToNull(request.addedVersion()), blankToNull(request.titleFolder()),
                request.bpmMin(), request.bpmMax());
        songRepository.save(song);
        saveTitles(song, request.titles());

        audit(actorId, "SONG_CREATE", "SONG", song.getId(), Map.of("title", song.getTitle()));
        return songQueryService.detailOf(song);
    }

    /** 수정(PUT): 보낸 값으로 교체한다. 출처(source)는 등록 때의 기록이라 바꾸지 않는다. */
    public SongDetailResponse updateSong(Long actorId, Long songId, SongRequest request) {
        Song song = findSong(songId);
        song.changeTitle(request.title().strip());
        song.changeArtist(blankToNull(request.artist()));
        song.changeMeta(blankToNull(request.addedVersion()), blankToNull(request.titleFolder()),
                request.bpmMin(), request.bpmMax());
        if (request.titles() != null) {
            // 곡 변경분을 먼저 DB에 반영(flush)한 뒤 표기를 지우고 다시 넣는다. 삭제는 벌크 쿼리라 바로 실행된다.
            songTitleRepository.deleteAllBySongId(song.getId());
            saveTitles(song, request.titles());
        }

        audit(actorId, "SONG_UPDATE", "SONG", song.getId(), Map.of("title", song.getTitle()));
        return songQueryService.detailOf(song);
    }

    public void deleteSong(Long actorId, Long songId) {
        Song song = findSong(songId);
        song.delete();
        audit(actorId, "SONG_DELETE", "SONG", song.getId(), Map.of("title", song.getTitle()));
    }

    // ---------------------------------------------------------------- 채보

    public DifficultyResponse createDifficulty(Long actorId, Long songId, DifficultyCreateRequest request) {
        Song song = findSong(songId);
        // (곡, 파트, 난이도 종류)는 유일하다. 소프트 삭제된 행도 유니크 키를 차지하므로 새로 넣지 않고 되살린다.
        SongDifficulty difficulty = songDifficultyRepository
                .findBySongIdAndInstrumentPartAndDifficultyType(songId, request.instrumentPart(), request.difficultyType())
                .map(existing -> {
                    if (!existing.isDeleted()) {
                        throw new ApiException(ErrorCode.CONFLICT);
                    }
                    existing.restore();
                    existing.changeLevel(request.level());
                    existing.changeNoteCount(request.noteCount());
                    return existing;
                })
                .orElseGet(() -> {
                    SongDifficulty created = SongDifficulty.create(song, request.instrumentPart(),
                            request.difficultyType(), request.level());
                    created.changeNoteCount(request.noteCount());
                    return created;
                });
        try {
            // 동시에 같은 채보를 등록하면 유니크 키 위반이 나므로 여기서 바로 반영해 409로 바꾼다
            songDifficultyRepository.saveAndFlush(difficulty);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.CONFLICT);
        }

        audit(actorId, "DIFFICULTY_CREATE", "SONG_DIFFICULTY", difficulty.getId(), difficultyDetail(difficulty));
        return DifficultyResponse.from(difficulty);
    }

    public DifficultyResponse updateDifficulty(Long actorId, Long difficultyId, DifficultyUpdateRequest request) {
        SongDifficulty difficulty = findDifficulty(difficultyId);
        difficulty.changeLevel(request.level());
        difficulty.changeNoteCount(request.noteCount());

        audit(actorId, "DIFFICULTY_UPDATE", "SONG_DIFFICULTY", difficulty.getId(), difficultyDetail(difficulty));
        return DifficultyResponse.from(difficulty);
    }

    public void deleteDifficulty(Long actorId, Long difficultyId) {
        SongDifficulty difficulty = findDifficulty(difficultyId);
        difficulty.delete();
        audit(actorId, "DIFFICULTY_DELETE", "SONG_DIFFICULTY", difficulty.getId(), difficultyDetail(difficulty));
    }

    // ---------------------------------------------------------------- 내부

    private Song findSong(Long songId) {
        return songRepository.findByIdAndDeletedFalse(songId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }

    private SongDifficulty findDifficulty(Long difficultyId) {
        SongDifficulty difficulty = songDifficultyRepository.findByIdAndDeletedFalse(difficultyId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        // 삭제된 곡에 딸린 채보는 보이지 않아야 한다
        if (difficulty.getSong().isDeleted()) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        return difficulty;
    }

    /** 같은 (종류, 정규화된 곡명)은 한 번만 넣는다. 유니크 키(uk_song_titles) 위반으로 500이 나는 것을 막는다. */
    private void saveTitles(Song song, List<SongTitleRequest> requests) {
        if (requests == null) {
            return;
        }
        Map<String, SongTitle> unique = new LinkedHashMap<>();
        for (SongTitleRequest r : requests) {
            SongTitle title = SongTitle.create(song, r.kind(), r.title().strip());
            unique.putIfAbsent(r.kind() + ":" + title.getNormalizedTitle(), title);
        }
        songTitleRepository.saveAll(unique.values());
    }

    private Map<String, Object> difficultyDetail(SongDifficulty d) {
        return Map.of("songId", d.getSong().getId(), "part", d.getInstrumentPart().name(),
                "type", d.getDifficultyType().name(), "level", d.getLevel().toPlainString());
    }

    /** 감사 로그. detail에는 식별용 값만 넣고 개인정보는 넣지 않는다. */
    private void audit(Long actorId, String action, String targetType, Long targetId, Map<String, Object> detail) {
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), action, targetType,
                String.valueOf(targetId), detail));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
