package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.DifficultyTableRequest;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DifficultyTableServiceTest {

    @Mock DifficultyTableRepository difficultyTableRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    DifficultyTableService service;

    @BeforeEach
    void setUp() {
        service = new DifficultyTableService(difficultyTableRepository, auditLogRepository, userRepository);
    }

    private DifficultyTableRequest request(String name) {
        return new DifficultyTableRequest(name, null, NoteOption.SUPER_RANDOM_PLUS);
    }

    @Test
    void 서열표를_만들면_감사_로그를_남긴다() {
        when(difficultyTableRepository.findByName("SRN+ 서열표")).thenReturn(Optional.empty());

        var response = service.create(1L, request("  SRN+ 서열표 "));

        assertThat(response.name()).isEqualTo("SRN+ 서열표");
        assertThat(response.revision()).isEqualTo(1);
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("DIFFICULTY_TABLE_CREATE");
    }

    @Test
    void 같은_이름이_있으면_409다() {
        when(difficultyTableRepository.findByName("SRN+ 서열표"))
                .thenReturn(Optional.of(DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS)));

        assertThatThrownBy(() -> service.create(1L, request("SRN+ 서열표"))).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 동시에_같은_이름으로_만들어_유니크_키에_걸리면_409다() {
        when(difficultyTableRepository.findByName(any())).thenReturn(Optional.empty());
        when(difficultyTableRepository.saveAndFlush(any(DifficultyTable.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> service.create(1L, request("표"))).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
    }
}
