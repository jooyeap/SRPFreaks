package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.TableEntryResponse;
import com.srpfreaks.backend.dto.TableEntryUpdateRequest;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.LabeledEnum;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Recommend;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 서열표 값(기준 난이도·추천도·속성) 수정과 표에 채보 추가 (ROOT·ADMIN, D26 직전 요청 2026-10-08).
 * DifficultyTableService(표 만들기·목록)와 분리한 이유: 그쪽 생성자와 테스트를 건드리지 않고 기능 하나로 모으려는 것이다.
 * 모든 변경은 audit_logs에 남기고, 표의 revision을 올려 "표가 바뀌었다"는 것을 추적한다.
 * 값을 고치면 "?"(불확실) 표시는 해제한다. 화면에 입력란이 없고 운영자가 직접 확인해 정한 값이기 때문이다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class TableEntryAdminService {

    private final DifficultyTableRepository difficultyTableRepository;
    private final DifficultyTableEntryRepository entryRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /**
     * (표, 채보) 한 줄의 값을 보낸 값으로 교체한다. 표에 그 채보가 없으면 새 줄로 추가한다(upsert).
     * 응답의 mine(내 기록)은 이 API의 관심사가 아니라 비워 두고, 화면은 서열표/곡 상세를 다시 불러온다.
     */
    public TableEntryResponse upsert(Long actorId, Long tableId, Long songDifficultyId, TableEntryUpdateRequest request) {
        DifficultyTable table = difficultyTableRepository.findById(tableId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        SongDifficulty chart = songDifficultyRepository.findByIdAndDeletedFalse(songDifficultyId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        // 표가 한 파트만 다루면(instrumentPart가 있으면) 다른 파트 채보는 올릴 수 없다
        if (table.getInstrumentPart() != null && table.getInstrumentPart() != chart.getInstrumentPart()) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }

        DifficultyTableEntry existing = entryRepository
                .findByDifficultyTableIdAndSongDifficultyId(tableId, songDifficultyId).orElse(null);
        boolean created = existing == null;
        DifficultyTableEntry entry = created ? DifficultyTableEntry.create(table, chart) : existing;
        Map<String, Object> before = created ? null : snapshot(entry);

        // 값을 고치면 불확실(?) 표시는 해제한다 (false). tier_order는 쓰지 않는 컬럼이라 기존 값을 그대로 둔다.
        entry.changeTier(request.tierLabel(), false, entry.getTierOrder());
        entry.changeRecommend(request.recommend() == null ? null
                : LabeledEnum.fromLabel(Recommend.class, request.recommend()), false);
        entry.changePattern(request.pattern() == null ? null
                : LabeledEnum.fromLabel(PatternType.class, request.pattern()), false);

        if (created) {
            try {
                // 동시에 같은 채보를 추가하면 유니크 키(uk_difficulty_table_entries) 위반이 나므로 바로 반영해 409로 바꾼다
                entryRepository.saveAndFlush(entry);
            } catch (DataIntegrityViolationException e) {
                throw new ApiException(ErrorCode.CONFLICT);
            }
        }
        table.bumpRevision();

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("difficultyTableId", tableId);
        detail.put("songDifficultyId", songDifficultyId);
        detail.put("after", snapshot(entry));
        if (before != null) {
            detail.put("before", before);
        }
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId),
                created ? "TABLE_ENTRY_CREATE" : "TABLE_ENTRY_UPDATE", "DIFFICULTY_TABLE_ENTRY",
                String.valueOf(entry.getId()), detail));
        return TableEntryResponse.of(entry, null);
    }

    /** 감사 로그용 값 요약. null 값도 남겨야 "지웠다"가 보이므로 Map.of 대신 LinkedHashMap을 쓴다. */
    private static Map<String, Object> snapshot(DifficultyTableEntry entry) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("tier", entry.getTierLabel() == null ? null : entry.getTierLabel().toPlainString());
        values.put("recommend", entry.getRecommend() == null ? null : entry.getRecommend().getLabel());
        values.put("pattern", entry.getPatternType() == null ? null : entry.getPatternType().getLabel());
        return values;
    }
}
