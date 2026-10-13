package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecordAdminServiceTest {

    @Mock OptionRecordRepository optionRecordRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    RecordAdminService service;

    @BeforeEach
    void setUp() {
        service = new RecordAdminService(optionRecordRepository, auditLogRepository, userRepository);
    }

    private OptionRecord recordWithRate(String rate) {
        OptionRecord record = mock(OptionRecord.class);
        when(record.getAchievementRate()).thenReturn(new BigDecimal(rate));
        return record;
    }

    @Test
    void 그_유저의_그_채보_기록을_모두_지우고_감사_로그를_남긴다() {
        List<OptionRecord> records = List.of(recordWithRate("100.00"), recordWithRate("92.50"));
        when(optionRecordRepository.findByUserIdAndSongDifficultyId(7L, 10L)).thenReturn(records);

        int deleted = service.deleteChartRecords(1L, 7L, 10L);

        assertThat(deleted).isEqualTo(2);
        verify(optionRecordRepository).deleteAll(records);
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        AuditLog log = captor.getValue();
        assertThat(log.getAction()).isEqualTo("RECORD_ADMIN_DELETE");
        assertThat(log.getTargetType()).isEqualTo("RECORD");
        assertThat(log.getTargetId()).isEqualTo("7:10");
        assertThat(log.getDetail()).containsEntry("targetUserId", 7L)
                .containsEntry("songDifficultyId", 10L)
                .containsEntry("deletedCount", 2)
                .containsEntry("bestRate", "100.00");
    }

    @Test
    void 지울_기록이_없으면_404이고_아무것도_남기지_않는다() {
        when(optionRecordRepository.findByUserIdAndSongDifficultyId(7L, 10L)).thenReturn(List.of());

        assertThatThrownBy(() -> service.deleteChartRecords(1L, 7L, 10L))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(optionRecordRepository, never()).deleteAll(any());
        verify(auditLogRepository, never()).save(any());
    }
}
