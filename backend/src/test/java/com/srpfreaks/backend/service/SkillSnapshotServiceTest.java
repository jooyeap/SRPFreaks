package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillSnapshotResponse;
import com.srpfreaks.backend.dto.SkillSnapshotStatusResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SkillSnapshot;
import com.srpfreaks.backend.repository.SkillSnapshotRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SkillSnapshotServiceTest {

    static final long USER = 7L;
    static final NoteOption OPTION = NoteOption.SUPER_RANDOM_PLUS;
    /** UTC 10-10 15:30 = 서울 10-11 00:30. "하루"가 서울 날짜로 세어지는지 보려고 일부러 자정을 넘긴 시각으로 고정한다 */
    static final Instant NOW = Instant.parse("2026-10-10T15:30:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 10, 11);

    @Mock SkillSnapshotRepository snapshotRepository;
    @Mock SkillService skillService;
    @Mock UserRepository userRepository;

    SkillSnapshotService service;

    @BeforeEach
    void setUp() {
        service = new SkillSnapshotService(snapshotRepository, skillService, userRepository, Clock.fixed(NOW, ZoneOffset.UTC));
        lenient().when(skillService.ratingNoteOption()).thenReturn(OPTION);
    }

    private SkillEntryResponse anEntry() {
        return new SkillEntryResponse(1, 1L, 1L, "곡", null, null, null, null, "단일", null, false, null, null, null, null);
    }

    private SkillResponse skill(String total, String single, String other, boolean withEntries) {
        List<SkillEntryResponse> list = withEntries ? List.of(anEntry()) : List.of();
        return new SkillResponse(OPTION, new BigDecimal(total), new BigDecimal(single), new BigDecimal(other), null, 15, 25, list, List.of());
    }

    private SkillSnapshot snap(LocalDate date, String total, String single, String other) {
        return SkillSnapshot.create(null, OPTION, date, new BigDecimal(total), new BigDecimal(single), new BigDecimal(other));
    }

    // ---- create ----

    @Test
    void 기록하면_서울_날짜로_합계와_소계를_저장하고_이전_대비_증감을_돌려준다() {
        when(skillService.mySkill(USER)).thenReturn(skill("120.00", "70.00", "50.00", true));
        when(snapshotRepository.existsByUser_IdAndNoteOptionAndSnapshotDate(USER, OPTION, TODAY)).thenReturn(false);
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(USER, OPTION))
                .thenReturn(Optional.of(snap(LocalDate.of(2026, 10, 1), "100.50", "60.00", "40.50")));

        SkillSnapshotResponse response = service.create(USER);

        ArgumentCaptor<SkillSnapshot> captor = ArgumentCaptor.forClass(SkillSnapshot.class);
        verify(snapshotRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getSnapshotDate()).isEqualTo(TODAY); // UTC로는 10-10이지만 서울 날짜는 10-11
        assertThat(captor.getValue().getTotalScore()).isEqualByComparingTo("120.00");
        assertThat(response.change()).isEqualByComparingTo("19.50");
        assertThat(response.date()).isEqualTo(TODAY);
    }

    @Test
    void 첫_기록은_증감이_없다() {
        when(skillService.mySkill(USER)).thenReturn(skill("120.00", "70.00", "50.00", true));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(USER, OPTION)).thenReturn(Optional.empty());

        assertThat(service.create(USER).change()).isNull();
    }

    @Test
    void 오늘_이미_기록했으면_거부한다() {
        when(skillService.mySkill(USER)).thenReturn(skill("120.00", "70.00", "50.00", true));
        when(snapshotRepository.existsByUser_IdAndNoteOptionAndSnapshotDate(USER, OPTION, TODAY)).thenReturn(true);

        assertThatThrownBy(() -> service.create(USER))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.SNAPSHOT_ALREADY_TODAY));
        verify(snapshotRepository, never()).saveAndFlush(any());
    }

    @Test
    void 마지막_기록과_합계와_소계가_같으면_거부한다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.50", "60.00", "40.50", true));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(USER, OPTION))
                .thenReturn(Optional.of(snap(LocalDate.of(2026, 10, 1), "100.5", "60.0", "40.5")));

        assertThatThrownBy(() -> service.create(USER))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.SNAPSHOT_NO_CHANGE));
        verify(snapshotRepository, never()).saveAndFlush(any());
    }

    @Test
    void 합계가_같아도_소계가_다르면_기록한다() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.50", "61.00", "39.50", true));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(USER, OPTION))
                .thenReturn(Optional.of(snap(LocalDate.of(2026, 10, 1), "100.50", "60.00", "40.50")));

        assertThat(service.create(USER).totalScore()).isEqualByComparingTo("100.50");
        verify(snapshotRepository).saveAndFlush(any());
    }

    @Test
    void 레이팅에_들어간_기록이_없으면_거부한다() {
        when(skillService.mySkill(USER)).thenReturn(skill("0.00", "0.00", "0.00", false));

        assertThatThrownBy(() -> service.create(USER))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.SNAPSHOT_NO_RECORDS));
    }

    @Test
    void 동시에_눌려_유일_키를_어기면_오늘_이미_기록함으로_답한다() {
        when(skillService.mySkill(USER)).thenReturn(skill("120.00", "70.00", "50.00", true));
        when(snapshotRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uk_skill_snapshots_day"));

        assertThatThrownBy(() -> service.create(USER))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.SNAPSHOT_ALREADY_TODAY));
    }

    // ---- status ----

    @Test
    void 상태는_저장하지_않고_막는_이유를_코드로_알려_준다() {
        when(skillService.mySkill(USER)).thenReturn(skill("120.00", "70.00", "50.00", true));
        assertThat(service.status(USER)).isEqualTo(SkillSnapshotStatusResponse.ok());

        when(snapshotRepository.existsByUser_IdAndNoteOptionAndSnapshotDate(USER, OPTION, TODAY)).thenReturn(true);
        assertThat(service.status(USER)).isEqualTo(SkillSnapshotStatusResponse.blocked("ALREADY_TODAY"));
        verify(snapshotRepository, never()).saveAndFlush(any());
    }

    @Test
    void 상태_변경없음과_기록없음_이유() {
        when(skillService.mySkill(USER)).thenReturn(skill("100.50", "60.00", "40.50", true));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionOrderBySnapshotDateDesc(USER, OPTION))
                .thenReturn(Optional.of(snap(LocalDate.of(2026, 10, 1), "100.50", "60.00", "40.50")));
        assertThat(service.status(USER).reason()).isEqualTo("NO_CHANGE");

        when(skillService.mySkill(USER)).thenReturn(skill("0.00", "0.00", "0.00", false));
        assertThat(service.status(USER).reason()).isEqualTo("NO_RECORDS");
    }

    // ---- list ----

    @Test
    void 목록은_최근_순이고_증감은_바로_이전_스냅샷과의_합계_차이다_마지막_줄은_다음_페이지에서_찾는다() {
        SkillSnapshot newest = snap(LocalDate.of(2026, 10, 9), "130.00", "70.00", "60.00");
        SkillSnapshot middle = snap(LocalDate.of(2026, 10, 5), "120.00", "70.00", "50.00");
        Pageable pageable = PageRequest.of(0, 2);
        when(snapshotRepository.findByUser_IdAndNoteOptionOrderBySnapshotDateDesc(eq(USER), eq(OPTION), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(newest, middle), pageable, 3));
        // middle의 이전 = 다음 페이지에 있는 가장 오래된 스냅샷
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(USER, OPTION, LocalDate.of(2026, 10, 5)))
                .thenReturn(Optional.of(snap(LocalDate.of(2026, 10, 1), "100.00", "60.00", "40.00")));

        PageResponse<SkillSnapshotResponse> result = service.list(USER, 0, 2);

        // BigDecimal의 equals는 스케일까지 비교하므로 double로 바꿔 값만 본다
        assertThat(result.content()).extracting(r -> r.change().doubleValue()).containsExactly(10.0, 20.0);
        assertThat(result.totalElements()).isEqualTo(3);
    }

    @Test
    void 가장_오래된_스냅샷의_증감은_null이다() {
        SkillSnapshot only = snap(LocalDate.of(2026, 10, 1), "100.00", "60.00", "40.00");
        when(snapshotRepository.findByUser_IdAndNoteOptionOrderBySnapshotDateDesc(eq(USER), eq(OPTION), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(only), PageRequest.of(0, 10), 1));
        when(snapshotRepository.findFirstByUser_IdAndNoteOptionAndSnapshotDateBeforeOrderBySnapshotDateDesc(eq(USER), eq(OPTION), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        assertThat(service.list(USER, 0, 10).content().get(0).change()).isNull();
    }

    @Test
    void 이상한_page와_size는_허용_범위로_맞춘다() {
        when(snapshotRepository.findByUser_IdAndNoteOptionOrderBySnapshotDateDesc(eq(USER), eq(OPTION), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 50), 0));

        service.list(USER, -3, 9999);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(snapshotRepository).findByUser_IdAndNoteOptionOrderBySnapshotDateDesc(eq(USER), eq(OPTION), captor.capture());
        assertThat(captor.getValue().getPageNumber()).isZero();
        assertThat(captor.getValue().getPageSize()).isEqualTo(SkillSnapshotService.MAX_PAGE_SIZE);
    }
}
