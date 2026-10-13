package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SettingResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettingAdminServiceTest {

    @Mock AppSettingRepository appSettingRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    SettingAdminService service;
    List<AppSetting> settings;
    User root;

    @BeforeEach
    void setUp() {
        service = new SettingAdminService(appSettingRepository, auditLogRepository, userRepository);
        root = User.create("sub-root", "root@example.com", "ルート");
        settings = new ArrayList<>(List.of(
                setting("rating.pivot", "6.0"), setting("rating.high_slope", "5"), setting("rating.high_offset", "15"),
                setting("rating.low_slope", "10"), setting("rating.low_offset", "45"),
                setting("rating.cap_rate", "80"), setting("rating.max_rate", "95"), setting("rating.bonus", "3.2"),
                setting("rating.score_multiplier", "20"), setting("rating.list_single", "15"),
                setting("rating.list_other", "25"), setting("rating.note_option", "SUPER_RANDOM_PLUS"),
                setting("ui.show_song_images", "false"), setting("contact.takedown_email", "a@example.com")));
        lenient().when(appSettingRepository.findAll()).thenReturn(settings);
        lenient().when(appSettingRepository.findAllWithUpdatedBy()).thenReturn(settings);
        lenient().when(appSettingRepository.findById(any(String.class))).thenAnswer(invocation ->
                settings.stream().filter(s -> s.getKey().equals(invocation.getArgument(0))).findFirst());
        lenient().when(userRepository.getReferenceById(1L)).thenReturn(root);
    }

    private AppSetting setting(String key, String value) {
        return AppSetting.create(key, value, null);
    }

    private void assertRejected(String key, String value) {
        assertThatThrownBy(() -> service.update(1L, key, value))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }

    @Test
    void 목록은_키_순으로_정렬하고_페이지로_자른다() {
        PageResponse<SettingResponse> first = service.list(0, 5);
        PageResponse<SettingResponse> last = service.list(2, 5);

        assertThat(first.content()).hasSize(5);
        assertThat(first.content()).extracting(SettingResponse::key).isSorted();
        assertThat(first.content().get(0).key()).isEqualTo("contact.takedown_email");
        assertThat(first.totalElements()).isEqualTo(14);
        assertThat(first.totalPages()).isEqualTo(3);
        assertThat(last.content()).hasSize(4); // 14개 중 11~14번째
        assertThat(service.list(9, 5).content()).isEmpty();
        assertThat(service.list(-1, 0).content()).hasSize(1); // 범위 밖 값은 허용 범위로 맞춘다
    }

    @Test
    void 값을_바꾸면_저장하고_변경_전후를_감사_로그에_남긴다() {
        SettingResponse response = service.update(1L, "rating.list_single", " 20 ");

        assertThat(response.value()).isEqualTo("20");
        assertThat(response.updatedByNickname()).isEqualTo("ルート");
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        AuditLog log = captor.getValue();
        assertThat(log.getAction()).isEqualTo("SETTING_UPDATE");
        assertThat(log.getTargetType()).isEqualTo("SETTING");
        assertThat(log.getTargetId()).isEqualTo("rating.list_single");
        assertThat(log.getDetail()).containsEntry("before", "15").containsEntry("after", "20");
    }

    @Test
    void 없는_키는_404이고_새_키를_만들지_않는다() {
        assertThatThrownBy(() -> service.update(1L, "rating.nothing", "1"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(appSettingRepository, never()).save(any(AppSetting.class));
    }

    @Test
    void 숫자가_아닌_레이팅_값은_거절한다() {
        assertRejected("rating.bonus", "abc");
        assertRejected("rating.list_single", "1.5");
        assertRejected("rating.note_option", "NOT_AN_OPTION");
    }

    @Test
    void 만점_달성률이_기준_달성률_이하이면_거절한다() {
        assertRejected("rating.max_rate", "80");
        assertRejected("rating.cap_rate", "95");
        assertThat(settings.stream().filter(s -> s.getKey().equals("rating.max_rate")).findFirst().orElseThrow().getValue())
                .isEqualTo("95"); // 거절된 값은 저장되지 않았다
    }

    @Test
    void 레이팅_목록_개수는_음수일_수_없다() {
        assertRejected("rating.list_other", "-1");
    }

    @Test
    void 이미지_표시_설정은_true_또는_false만_받는다() {
        assertRejected("ui.show_song_images", "yes");
        assertThat(service.update(1L, "ui.show_song_images", "true").value()).isEqualTo("true");
    }

    @Test
    void 빈_값은_거절한다() {
        assertRejected("contact.takedown_email", "   ");
        assertRejected("rating.pivot", "");
    }
}
