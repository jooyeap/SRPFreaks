package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.DifficultyTableRequest;
import com.srpfreaks.backend.dto.DifficultyTableResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** 서열표(난이도표) 만들기와 목록. 표의 내용(항목)은 초기 시드 SQL로 넣는다(docs/DESIGN.md 시드 입력). */
@Service
@RequiredArgsConstructor
public class DifficultyTableService {

    private final DifficultyTableRepository difficultyTableRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<DifficultyTableResponse> list() {
        return difficultyTableRepository.findAll().stream().map(DifficultyTableResponse::from).toList();
    }

    @Transactional
    public DifficultyTableResponse create(Long actorId, DifficultyTableRequest request) {
        String name = request.name().strip();
        if (difficultyTableRepository.findByName(name).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT);
        }
        DifficultyTable table = DifficultyTable.create(name, request.instrumentPart(), request.noteOption());
        try {
            // 동시에 같은 이름으로 만들면 유니크 키(uk_difficulty_tables_name) 위반이 나므로 바로 반영해 409로 바꾼다
            difficultyTableRepository.saveAndFlush(table);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.CONFLICT);
        }
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), "DIFFICULTY_TABLE_CREATE",
                "DIFFICULTY_TABLE", String.valueOf(table.getId()), Map.of("name", table.getName())));
        return DifficultyTableResponse.from(table);
    }
}
