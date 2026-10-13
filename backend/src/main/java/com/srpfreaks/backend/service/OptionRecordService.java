package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RecordRequest;
import com.srpfreaks.backend.dto.RecordResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * 옵션 기록 입력·조회·수정·삭제. 기록은 항상 "토큰의 사용자(userId)" 범위에서만 다룬다.
 *
 * 보안 포인트 (왜 이렇게 했는가)
 * - userId는 요청 본문/경로가 아니라 인증 정보에서만 받는다. 다른 사용자를 지정할 방법이 없다.
 * - 수정/삭제/단건 조회는 (기록 id + 소유자 id)를 함께 조건으로 조회한다. 타인의 기록이든 없는 기록이든
 *   똑같이 404가 되므로, 응답으로 기록 존재 여부를 알아낼 수 없다.
 * - ADMIN/ROOT도 다른 사용자의 기록은 고치지 않는다(CLAUDE.md). 그래서 이 서비스에는 역할 예외를 두지 않는다. 관리자의 삭제(D29)는 별도 RecordAdminService가 맡는다.
 */
@Service
@RequiredArgsConstructor
public class OptionRecordService {

    public static final int MAX_PAGE_SIZE = 50;
    public static final int DEFAULT_PAGE_SIZE = 20;

    /**
     * 기록으로 받는 노트 옵션 (D25). 지금은 SUPER_RANDOM_PLUS 하나다.
     * enum과 DB 컬럼(note_option)은 그대로 두었으므로, 나중에 옵션을 늘리려면 이 집합에 값만 추가하면 된다.
     */
    static final Set<NoteOption> RECORDABLE_OPTIONS = EnumSet.of(NoteOption.SUPER_RANDOM_PLUS);
    static final NoteOption DEFAULT_OPTION = NoteOption.SUPER_RANDOM_PLUS;

    /** 서버와 기기 시계 차이를 감안해, 현재보다 이만큼까지는 미래 시각도 허용한다. */
    static final Duration FUTURE_TOLERANCE = Duration.ofMinutes(5);

    // 정렬은 화이트리스트로만 받는다. id를 마지막에 붙여 같은 값일 때도 순서가 매번 같게 한다.
    private static final Map<String, Sort> SORTS = Map.of(
            "recent", Sort.by(Sort.Direction.DESC, "playedAt").and(Sort.by(Sort.Direction.DESC, "id")),
            "rate", Sort.by(Sort.Direction.DESC, "achievementRate").and(Sort.by(Sort.Direction.DESC, "id")));

    private final OptionRecordRepository optionRecordRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final UserRepository userRepository;

    @Transactional
    public RecordResponse create(Long userId, RecordRequest request) {
        if (request.songDifficultyId() == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        // 삭제된 채보·곡에는 기록을 만들 수 없다(없는 것과 같은 404)
        SongDifficulty difficulty = songDifficultyRepository.findByIdAndDeletedFalse(request.songDifficultyId())
                .filter(d -> !d.getSong().isDeleted())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        checkPlayedAt(request.playedAt());

        OptionRecord record = OptionRecord.create(userRepository.getReferenceById(userId), difficulty,
                resolveOption(request.noteOption()), request.achievementRate(), request.fullCombo(),
                request.playedAt(), request.platform(), normalizeMemo(request.memo()));
        optionRecordRepository.save(record);
        return RecordResponse.from(record);
    }

    @Transactional(readOnly = true)
    public RecordResponse get(Long userId, Long recordId) {
        return RecordResponse.from(findOwned(userId, recordId));
    }

    @Transactional(readOnly = true)
    public PageResponse<RecordResponse> list(Long userId, NoteOption noteOption, Long songDifficultyId,
                                             int page, int size, String sort) {
        Sort order = SORTS.get(sort == null || sort.isBlank() ? "recent" : sort);
        if (order == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE), order);
        Page<OptionRecord> result = optionRecordRepository.findMine(userId, noteOption, songDifficultyId, pageable);
        return PageResponse.of(result, RecordResponse::from);
    }

    @Transactional
    public RecordResponse update(Long userId, Long recordId, RecordRequest request) {
        OptionRecord record = findOwned(userId, recordId);
        checkPlayedAt(request.playedAt());
        // 변경 감지(dirty checking): 엔티티 값만 바꾸면 트랜잭션이 끝날 때 UPDATE가 나간다. save 호출 불필요.
        record.update(resolveOption(request.noteOption()), request.achievementRate(), request.fullCombo(),
                request.playedAt(), request.platform(), normalizeMemo(request.memo()));
        return RecordResponse.from(record);
    }

    @Transactional
    public void delete(Long userId, Long recordId) {
        // 기록은 소프트 삭제 없이 지운다(D20). 소유자 확인을 거친 뒤에만 지운다.
        optionRecordRepository.delete(findOwned(userId, recordId));
    }

    private OptionRecord findOwned(Long userId, Long recordId) {
        return optionRecordRepository.findDetailByIdAndUserId(recordId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }

    /** 비어 있으면 기본 옵션(SRN+), 받지 않는 옵션이면 400. */
    private static NoteOption resolveOption(NoteOption requested) {
        if (requested == null) {
            return DEFAULT_OPTION;
        }
        if (!RECORDABLE_OPTIONS.contains(requested)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        return requested;
    }

    private static void checkPlayedAt(Instant playedAt) {
        if (playedAt != null && playedAt.isAfter(Instant.now().plus(FUTURE_TOLERANCE))) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
    }

    /** 공백만 있는 메모는 저장하지 않는다. 문구는 사용자가 쓴 그대로 두고 앞뒤 공백만 뗀다. */
    private static String normalizeMemo(String memo) {
        if (memo == null || memo.isBlank()) {
            return null;
        }
        return memo.strip();
    }
}
