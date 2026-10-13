package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.TableEntryResponse;
import com.srpfreaks.backend.dto.TableEntryUpdateRequest;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Recommend;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
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
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TableEntryAdminServiceTest {

    @Mock DifficultyTableRepository tableRepository;
    @Mock DifficultyTableEntryRepository entryRepository;
    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserRepository userRepository;

    TableEntryAdminService service;
    DifficultyTable table;
    SongDifficulty chart;

    @BeforeEach
    void setUp() {
        service = new TableEntryAdminService(tableRepository, entryRepository, songDifficultyRepository,
                auditLogRepository, userRepository);
        table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
        Song song = Song.create("테스트곡", null, "test", null);
        ReflectionTestUtils.setField(song, "id", 5L);
        chart = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.80"));
        ReflectionTestUtils.setField(chart, "id", 10L);
    }

    private void givenTableAndChart() {
        when(tableRepository.findById(1L)).thenReturn(Optional.of(table));
        when(songDifficultyRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(chart));
    }

    private TableEntryUpdateRequest request(String tier, String recommend, String pattern) {
        return new TableEntryUpdateRequest(tier == null ? null : new BigDecimal(tier), recommend, pattern);
    }

    private DifficultyTableEntry existingEntry() {
        DifficultyTableEntry e = DifficultyTableEntry.create(table, chart);
        ReflectionTestUtils.setField(e, "id", 77L);
        e.changeTier(new BigDecimal("5.8"), true, null);
        e.changeRecommend(Recommend.MIDDLE, true);
        e.changePattern(PatternType.SINGLE, true);
        // 이미 있던 줄은 레이팅 반영이 켜져 있다(D28: 새로 만든 줄만 꺼짐으로 시작하고, 마이그레이션 전부터 있던 줄은 켜짐)
        e.changeRatingEnabled(true);
        return e;
    }

    @Test
    void 표에_있는_채보는_보낸_값으로_교체하고_불확실_표시를_해제한다() {
        givenTableAndChart();
        DifficultyTableEntry entry = existingEntry();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.of(entry));

        TableEntryResponse response = service.upsert(1L, 1L, 10L, request("6.1", "상", "복합"));

        assertThat(entry.getTierLabel()).isEqualByComparingTo("6.1");
        assertThat(entry.getRecommend()).isEqualTo(Recommend.HIGH);
        assertThat(entry.getPatternType()).isEqualTo(PatternType.COMPOUND);
        assertThat(entry.isTierUncertain()).isFalse();
        assertThat(entry.isRecommendUncertain()).isFalse();
        assertThat(entry.isPatternUncertain()).isFalse();
        assertThat(response.recommend()).isEqualTo("상");
        assertThat(response.pattern()).isEqualTo("복합");
        assertThat(response.mine()).isNull();
        // 새 줄이 아니므로 저장 호출 없이 영속 상태의 변경 감지로 반영된다
        verify(entryRepository, never()).saveAndFlush(any());
    }

    @Test
    void 표에_없는_채보는_새_줄로_추가한다() {
        givenTableAndChart();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.empty());

        TableEntryResponse response = service.upsert(1L, 1L, 10L, request("5.4", "중", "단일"));

        ArgumentCaptor<DifficultyTableEntry> saved = ArgumentCaptor.forClass(DifficultyTableEntry.class);
        verify(entryRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getSongDifficulty()).isSameAs(chart);
        assertThat(saved.getValue().getTierLabel()).isEqualByComparingTo("5.4");
        assertThat(response.pattern()).isEqualTo("단일");
    }

    @Test
    void 값을_비우면_미정과_값_없음으로_저장한다() {
        givenTableAndChart();
        DifficultyTableEntry entry = existingEntry();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.of(entry));

        service.upsert(1L, 1L, 10L, request(null, null, null));

        assertThat(entry.getTierLabel()).isNull();
        assertThat(entry.getRecommend()).isNull();
        assertThat(entry.getPatternType()).isNull();
        assertThat(entry.isRatable()).isFalse();
    }

    @Test
    void 속성을_레이팅_제외로_바꾸면_레이팅_대상에서_빠진다() {
        givenTableAndChart();
        DifficultyTableEntry entry = existingEntry();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.of(entry));
        assertThat(entry.isRatable()).isTrue();

        service.upsert(1L, 1L, 10L, request("5.8", "중", "레이팅 제외"));

        assertThat(entry.getPatternType()).isEqualTo(PatternType.EXCLUDED);
        assertThat(entry.isRatable()).isFalse();
    }

    @Test
    void 수정하면_표의_revision을_올리고_감사_로그에_전후_값을_남긴다() {
        givenTableAndChart();
        DifficultyTableEntry entry = existingEntry();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.of(entry));
        int revision = table.getRevision();

        service.upsert(1L, 1L, 10L, request("6.1", "상", "복합"));

        assertThat(table.getRevision()).isEqualTo(revision + 1);
        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("TABLE_ENTRY_UPDATE");
        assertThat(audit.getValue().getTargetType()).isEqualTo("DIFFICULTY_TABLE_ENTRY");
        assertThat(audit.getValue().getTargetId()).isEqualTo("77");
        Map<String, Object> detail = audit.getValue().getDetail();
        assertThat(detail.get("before")).isEqualTo(Map.of("tier", "5.8", "recommend", "중", "pattern", "단일", "ratingEnabled", true));
        assertThat(detail.get("after")).isEqualTo(Map.of("tier", "6.1", "recommend", "상", "pattern", "복합", "ratingEnabled", true));
    }

    @Test
    void 새_줄을_추가하면_감사_로그_종류가_CREATE이고_이전_값은_없다() {
        givenTableAndChart();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.empty());

        service.upsert(1L, 1L, 10L, request("5.4", "중", "단일"));

        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("TABLE_ENTRY_CREATE");
        assertThat(audit.getValue().getDetail()).doesNotContainKey("before");
    }

    @Test
    void 없는_표나_없는_채보는_404다() {
        when(tableRepository.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.upsert(1L, 9L, 10L, request("5.8", null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));

        when(tableRepository.findById(1L)).thenReturn(Optional.of(table));
        when(songDifficultyRepository.findByIdAndDeletedFalse(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.upsert(1L, 1L, 99L, request("5.8", null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void 표가_한_파트만_다루면_다른_파트_채보는_400이다() {
        DifficultyTable guitarOnly = DifficultyTable.create("기타 전용", InstrumentPart.GUITAR, NoteOption.SUPER_RANDOM_PLUS);
        Song song = Song.create("베이스곡", null, "test", null);
        SongDifficulty bass = SongDifficulty.create(song, InstrumentPart.BASS, DifficultyType.MASTER, new BigDecimal("8.00"));
        when(tableRepository.findById(2L)).thenReturn(Optional.of(guitarOnly));
        when(songDifficultyRepository.findByIdAndDeletedFalse(20L)).thenReturn(Optional.of(bass));

        assertThatThrownBy(() -> service.upsert(1L, 2L, 20L, request("5.8", null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));
        verify(entryRepository, never()).saveAndFlush(any());
    }

    @Test
    void 동시에_같은_채보를_추가해_유니크_키가_깨지면_409다() {
        givenTableAndChart();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.empty());
        when(entryRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("dup"));

        assertThatThrownBy(() -> service.upsert(1L, 1L, 10L, request("5.8", null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
        verify(auditLogRepository, never()).save(any());
    }
    private TableEntryUpdateRequest requestWithSwitch(Boolean ratingEnabled) {
        return new TableEntryUpdateRequest(new BigDecimal("5.8"), "상", "단일", ratingEnabled);
    }

    @Test
    void 새_줄은_스위치를_보내지_않으면_꺼진_채로_추가한다() {
        givenTableAndChart();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.empty());

        TableEntryResponse response = service.upsert(1L, 1L, 10L, requestWithSwitch(null));

        assertThat(response.ratingEnabled()).isFalse();
    }

    @Test
    void 새_줄도_스위치를_켜서_보내면_켜진_채로_추가한다() {
        givenTableAndChart();
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.empty());

        TableEntryResponse response = service.upsert(1L, 1L, 10L, requestWithSwitch(true));

        assertThat(response.ratingEnabled()).isTrue();
    }

    @Test
    void 스위치를_보내지_않으면_기존_값을_그대로_둔다() {
        givenTableAndChart();
        DifficultyTableEntry entry = existingEntry();
        entry.changeRatingEnabled(true);
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.of(entry));

        TableEntryResponse response = service.upsert(1L, 1L, 10L, requestWithSwitch(null));

        assertThat(response.ratingEnabled()).isTrue();
        assertThat(entry.isRatingEnabled()).isTrue();
    }

    @Test
    void 스위치를_끄면_저장되고_감사_로그에_이전_값과_바뀐_값이_남는다() {
        givenTableAndChart();
        DifficultyTableEntry entry = existingEntry();
        entry.changeRatingEnabled(true);
        when(entryRepository.findByDifficultyTableIdAndSongDifficultyId(1L, 10L)).thenReturn(Optional.of(entry));

        TableEntryResponse response = service.upsert(1L, 1L, 10L, requestWithSwitch(false));

        assertThat(response.ratingEnabled()).isFalse();
        ArgumentCaptor<AuditLog> log = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(log.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> detail = (Map<String, Object>) ReflectionTestUtils.getField(log.getValue(), "detail");
        @SuppressWarnings("unchecked")
        Map<String, Object> before = (Map<String, Object>) detail.get("before");
        @SuppressWarnings("unchecked")
        Map<String, Object> after = (Map<String, Object>) detail.get("after");
        assertThat(before.get("ratingEnabled")).isEqualTo(true);
        assertThat(after.get("ratingEnabled")).isEqualTo(false);
    }
}
