package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 관리자(ADMIN·ROOT)의 기록 삭제 (D29). 일부러 만든 가짜 기록(예: 100%)을 지우기 위한 것이다.
 *
 * 허용하는 것은 "삭제"뿐이다. 다른 사용자의 기록을 고치는 기능은 없다(D15는 수정 금지를 유지한다).
 * 유저 상세 화면에는 채보별 최고 기록만 보이므로, 단위는 "그 유저의 그 채보 기록 전부"다.
 * 최고 기록 한 건만 지우면 그 다음 기록이 최고로 올라와 가짜가 남을 수 있기 때문이다.
 * 삭제는 되돌릴 수 없는 hard delete이고(D20), 누가 무엇을 지웠는지 audit_logs에 남긴다.
 * 로그에는 닉네임·이메일 같은 개인정보를 넣지 않고 id와 숫자만 넣는다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RecordAdminService {

    public static final String ACTION = "RECORD_ADMIN_DELETE";

    private final OptionRecordRepository optionRecordRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /** 지운 기록 개수를 돌려준다. 지울 기록이 없으면 404(유저·채보가 없는 경우와 구분하지 않는다). */
    public int deleteChartRecords(Long actorId, Long targetUserId, Long songDifficultyId) {
        List<OptionRecord> records = optionRecordRepository.findByUserIdAndSongDifficultyId(targetUserId, songDifficultyId);
        if (records.isEmpty()) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        BigDecimal bestRate = records.stream().map(OptionRecord::getAchievementRate)
                .max(BigDecimal::compareTo).orElse(null);

        optionRecordRepository.deleteAll(records);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("targetUserId", targetUserId);
        detail.put("songDifficultyId", songDifficultyId);
        detail.put("deletedCount", records.size());
        detail.put("bestRate", bestRate == null ? null : bestRate.toPlainString());
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), ACTION, "RECORD",
                targetUserId + ":" + songDifficultyId, detail));
        return records.size();
    }
}
