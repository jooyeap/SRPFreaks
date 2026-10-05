package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RecordRequest;
import com.srpfreaks.backend.dto.RecordResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
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
class OptionRecordServiceTest {

    static final Long ME = 7L;
    static final Long OTHER = 8L;

    @Mock OptionRecordRepository recordRepository;
    @Mock SongDifficultyRepository difficultyRepository;
    @Mock UserRepository userRepository;

    OptionRecordService service;
    User me;
    SongDifficulty chart;

    @BeforeEach
    void setUp() {
        service = new OptionRecordService(recordRepository, difficultyRepository, userRepository);
        me = User.create("sub-me", "me@example.com", "me");
        ReflectionTestUtils.setField(me, "id", ME);
        Song song = Song.create("곡", null, "test", null);
        ReflectionTestUtils.setField(song, "id", 100L);
        chart = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50"));
        ReflectionTestUtils.setField(chart, "id", 200L);
        lenient().when(userRepository.getReferenceById(ME)).thenReturn(me);
    }

    private RecordRequest req(String rate, boolean fc) {
        return new RecordRequest(200L, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(rate), fc, null, null, null);
    }

    private OptionRecord record(String rate) {
        return OptionRecord.create(me, chart, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(rate), false, null, null, null);
    }

    @Test
    void 기록을_등록하면_저장하고_단계를_계산해_돌려준다() {
        when(difficultyRepository.findByIdAndDeletedFalse(200L)).thenReturn(Optional.of(chart));

        RecordResponse response = service.create(ME, req("96.50", false));

        ArgumentCaptor<OptionRecord> saved = ArgumentCaptor.forClass(OptionRecord.class);
        verify(recordRepository).save(saved.capture());
        assertThat(saved.getValue().getUser()).isSameAs(me);   // 소유자는 토큰의 사용자
        assertThat(response.achievementRate()).isEqualByComparingTo("96.50");
        assertThat(response.stage()).isEqualTo(AchievementStage.SS);
        assertThat(response.title()).isEqualTo("곡");
    }

    @Test
    void 달성률_100이면_FC가_아니어도_FC로_저장하고_EXC다() {
        when(difficultyRepository.findByIdAndDeletedFalse(200L)).thenReturn(Optional.of(chart));

        RecordResponse response = service.create(ME, req("100.00", false));

        assertThat(response.fullCombo()).isTrue();
        assertThat(response.stage()).isEqualTo(AchievementStage.EXC);
    }

    @Test
    void FC로_입력하면_96퍼센트여도_FC_단계다() {
        when(difficultyRepository.findByIdAndDeletedFalse(200L)).thenReturn(Optional.of(chart));

        assertThat(service.create(ME, req("96.00", true)).stage()).isEqualTo(AchievementStage.FC);
    }

    @Test
    void 없거나_삭제된_채보에는_기록할_수_없다() {
        when(difficultyRepository.findByIdAndDeletedFalse(200L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(ME, req("90.00", false)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(recordRepository, never()).save(any());
    }

    @Test
    void 삭제된_곡의_채보에는_기록할_수_없다() {
        chart.getSong().delete();
        when(difficultyRepository.findByIdAndDeletedFalse(200L)).thenReturn(Optional.of(chart));

        assertThatThrownBy(() -> service.create(ME, req("90.00", false))).isInstanceOf(ApiException.class);
    }

    @Test
    void 채보_id가_없으면_거부한다() {
        RecordRequest noChart = new RecordRequest(null, NoteOption.NORMAL, BigDecimal.TEN, false, null, null, null);

        assertThatThrownBy(() -> service.create(ME, noChart))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
    }

    @Test
    void 너무_먼_미래의_플레이_시각은_거부하고_가까운_미래는_허용한다() {
        when(difficultyRepository.findByIdAndDeletedFalse(200L)).thenReturn(Optional.of(chart));
        RecordRequest farFuture = new RecordRequest(200L, NoteOption.NORMAL, BigDecimal.TEN, false,
                Instant.now().plusSeconds(3600), null, null);
        RecordRequest soon = new RecordRequest(200L, NoteOption.NORMAL, BigDecimal.TEN, false,
                Instant.now().plusSeconds(60), null, null);

        assertThatThrownBy(() -> service.create(ME, farFuture)).isInstanceOf(ApiException.class);
        assertThat(service.create(ME, soon)).isNotNull();
    }

    @Test
    void 공백뿐인_메모는_null로_저장하고_앞뒤_공백을_뗀다() {
        when(difficultyRepository.findByIdAndDeletedFalse(200L)).thenReturn(Optional.of(chart));

        RecordRequest blank = new RecordRequest(200L, NoteOption.NORMAL, BigDecimal.TEN, false, null, null, "   ");
        RecordRequest padded = new RecordRequest(200L, NoteOption.NORMAL, BigDecimal.TEN, false, null, null, "  메모 ");

        assertThat(service.create(ME, blank).memo()).isNull();
        assertThat(service.create(ME, padded).memo()).isEqualTo("메모");
    }

    @Test
    void 본인_기록을_수정하면_값이_교체된다() {
        OptionRecord record = record("90.00");
        when(recordRepository.findDetailByIdAndUserId(1L, ME)).thenReturn(Optional.of(record));

        RecordResponse response = service.update(ME, 1L, req("99.00", true));

        assertThat(response.achievementRate()).isEqualByComparingTo("99.00");
        assertThat(response.stage()).isEqualTo(AchievementStage.FC);
        assertThat(record.getAchievementRate()).isEqualByComparingTo("99.00");
    }

    @Test
    void 타인의_기록은_조회_수정_삭제_모두_404다() {
        // 소유자 조건을 함께 건 조회가 비어 나오는 상황(타인의 기록이거나 없는 기록)
        when(recordRepository.findDetailByIdAndUserId(1L, OTHER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(OTHER, 1L)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.update(OTHER, 1L, req("90.00", false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.delete(OTHER, 1L)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(recordRepository, never()).delete(any());
    }

    @Test
    void 본인_기록을_삭제한다() {
        OptionRecord record = record("90.00");
        when(recordRepository.findDetailByIdAndUserId(1L, ME)).thenReturn(Optional.of(record));

        service.delete(ME, 1L);

        verify(recordRepository).delete(record);
    }

    @Test
    void 목록은_토큰의_사용자_범위로만_조회하고_크기_상한을_둔다() {
        when(recordRepository.findMine(any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(record("90.00"))));

        PageResponse<RecordResponse> page = service.list(ME, NoteOption.SUPER_RANDOM_PLUS, null, 0, 1000, "rate");

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(recordRepository).findMine(org.mockito.ArgumentMatchers.eq(ME),
                org.mockito.ArgumentMatchers.eq(NoteOption.SUPER_RANDOM_PLUS), org.mockito.ArgumentMatchers.isNull(),
                pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(OptionRecordService.MAX_PAGE_SIZE);
        assertThat(pageable.getValue().getSort().getOrderFor("achievementRate")).isNotNull();
        assertThat(page.content()).hasSize(1);
    }

    @Test
    void 허용되지_않은_정렬_값은_400이다() {
        assertThatThrownBy(() -> service.list(ME, null, null, 0, 20, "password; drop table"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));
    }
}
