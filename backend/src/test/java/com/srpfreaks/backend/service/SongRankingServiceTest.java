package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SongRankingResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.RankingRow;
import com.srpfreaks.backend.mapper.SongRankingMapper;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 곡별 순위(D74) 서비스. DB 없이 mapper를 가짜로 두고 순위 번호·단계·페이지·me 규칙만 확인한다.
 * 쿼리 자체(공개 유저만, 동점 정렬, 앞 사람 수)는 SongRankingMapperTest(Testcontainers)가 실제 MySQL에서 확인한다.
 */
@ExtendWith(MockitoExtension.class)
class SongRankingServiceTest {

    static final long CHART = 12L;
    static final long ME = 7L;
    static final String SRN_PLUS = NoteOption.SUPER_RANDOM_PLUS.name();
    static final LocalDateTime AT = LocalDateTime.of(2026, 11, 1, 12, 0);

    @Mock SongDifficultyRepository songDifficultyRepository;
    @Mock UserRepository userRepository;
    @Mock SongRankingMapper mapper;
    @Mock SkillService skillService;

    SongRankingService service;

    @BeforeEach
    void setUp() {
        service = new SongRankingService(songDifficultyRepository, userRepository, mapper, skillService);
        RatingConfig config = mock(RatingConfig.class);
        lenient().when(config.noteOption()).thenReturn(NoteOption.SUPER_RANDOM_PLUS);
        lenient().when(skillService.ratingConfig()).thenReturn(config);
        lenient().when(songDifficultyRepository.findByIdAndDeletedFalse(CHART)).thenReturn(Optional.of(mock(SongDifficulty.class)));
    }

    private static RankingRow row(long userId, String rate, boolean fc) {
        return new RankingRow(userId, "nick" + userId, new BigDecimal(rate), fc, AT);
    }

    private User viewer(boolean publicProfile) {
        User user = User.create("sub-me", "me@example.com", "meuser");
        if (publicProfile) {
            user.changeProfilePublic(true);
        }
        return user;
    }

    // ------------------------------------------------------------ 채보

    @Test
    void 채보가_없거나_삭제됐으면_404이고_아무것도_조회하지_않는다() {
        when(songDifficultyRepository.findByIdAndDeletedFalse(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.ranking(ME, 99L, 0, 20))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
        verify(mapper, never()).countPlayers(anyLong(), any());
        verify(mapper, never()).findPage(anyLong(), any(), org.mockito.ArgumentMatchers.anyInt(), anyLong());
    }

    // ------------------------------------------------------------ 목록

    @Test
    void 순위_번호는_페이지_위치로_이어지고_건너뛰지_않는다() {
        // 2페이지(page=1, size=2) -> offset 2 -> 3위, 4위
        when(userRepository.findById(ME)).thenReturn(Optional.of(viewer(false)));
        when(mapper.countPlayers(CHART, SRN_PLUS)).thenReturn(5L);
        when(mapper.findPage(CHART, SRN_PLUS, 2, 2L)).thenReturn(List.of(row(30, "90.00", false), row(40, "80.00", false)));

        SongRankingResponse res = service.ranking(ME, CHART, 1, 2);

        assertThat(res.items()).extracting(SongRankingResponse.Item::rank).containsExactly(3, 4);
        assertThat(res.items()).extracting(SongRankingResponse.Item::userId).containsExactly(30L, 40L);
        assertThat(res.players()).isEqualTo(5);
        assertThat(res.page()).isEqualTo(1);
        assertThat(res.size()).isEqualTo(2);
        assertThat(res.totalPages()).isEqualTo(3);   // 5명 / 2 = 올림 3
    }

    @Test
    void 달성_단계는_저장하지_않고_달성률과_FC로_계산한다() {
        when(userRepository.findById(ME)).thenReturn(Optional.of(viewer(false)));
        when(mapper.countPlayers(CHART, SRN_PLUS)).thenReturn(4L);
        when(mapper.findPage(CHART, SRN_PLUS, 20, 0L)).thenReturn(List.of(
                row(1, "100.00", false),   // EXC
                row(2, "99.00", true),     // FC
                row(3, "96.00", false),    // SS
                row(4, "80.00", false)));  // S

        SongRankingResponse res = service.ranking(ME, CHART, 0, 20);

        assertThat(res.items()).extracting(SongRankingResponse.Item::stage)
                .containsExactly(AchievementStage.EXC, AchievementStage.FC, AchievementStage.SS, AchievementStage.S);
    }

    @Test
    void 내_줄은_isMe로_표시된다() {
        when(userRepository.findById(ME)).thenReturn(Optional.of(viewer(false)));
        when(mapper.countPlayers(CHART, SRN_PLUS)).thenReturn(2L);
        when(mapper.findPage(CHART, SRN_PLUS, 20, 0L)).thenReturn(List.of(row(ME, "99.00", false), row(8, "98.00", false)));

        SongRankingResponse res = service.ranking(ME, CHART, 0, 20);

        assertThat(res.items()).extracting(SongRankingResponse.Item::isMe).containsExactly(true, false);
    }

    @Test
    void 공개_유저가_1명이어도_표시하고_0명이면_빈_목록이다() {
        // 인원 기준이 없다(D74 결정 3): 숨김 상태가 없고, 0명도 오류가 아니라 빈 목록이다
        when(userRepository.findById(ME)).thenReturn(Optional.of(viewer(true)));
        when(mapper.countPlayers(CHART, SRN_PLUS)).thenReturn(1L, 0L);
        when(mapper.findPage(CHART, SRN_PLUS, 20, 0L)).thenReturn(List.of(row(5, "70.00", false)), List.of());
        when(mapper.findMine(CHART, SRN_PLUS, ME)).thenReturn(null);

        SongRankingResponse one = service.ranking(ME, CHART, 0, 20);
        assertThat(one.players()).isEqualTo(1);
        assertThat(one.items()).hasSize(1);
        assertThat(one.totalPages()).isEqualTo(1);

        SongRankingResponse none = service.ranking(ME, CHART, 0, 20);
        assertThat(none.players()).isZero();
        assertThat(none.items()).isEmpty();
        assertThat(none.totalPages()).isZero();
        assertThat(none.me()).isNull();   // 공개인데 기록이 없다
    }

    @Test
    void 범위를_벗어난_page와_size는_안전한_값으로_맞춘다() {
        when(userRepository.findById(ME)).thenReturn(Optional.of(viewer(false)));
        when(mapper.countPlayers(CHART, SRN_PLUS)).thenReturn(0L);
        when(mapper.findPage(CHART, SRN_PLUS, 50, 0L)).thenReturn(List.of());
        when(mapper.findPage(CHART, SRN_PLUS, 1, 0L)).thenReturn(List.of());

        SongRankingResponse big = service.ranking(ME, CHART, -3, 999);   // size 상한 50, page 음수는 0
        assertThat(big.size()).isEqualTo(50);
        assertThat(big.page()).isZero();

        SongRankingResponse small = service.ranking(ME, CHART, 0, 0);    // size 하한 1
        assertThat(small.size()).isEqualTo(1);
    }

    // ------------------------------------------------------------ me

    @Test
    void 내가_공개_유저이고_기록이_있으면_내_앞_사람_수_더하기_1이_내_순위다() {
        when(userRepository.findById(ME)).thenReturn(Optional.of(viewer(true)));
        when(mapper.countPlayers(CHART, SRN_PLUS)).thenReturn(10L);
        when(mapper.findPage(CHART, SRN_PLUS, 3, 0L)).thenReturn(List.of());
        RankingRow mine = row(ME, "96.12", false);
        when(mapper.findMine(CHART, SRN_PLUS, ME)).thenReturn(mine);
        when(mapper.countAhead(CHART, SRN_PLUS, mine.bestRate(), AT, ME)).thenReturn(6L);

        SongRankingResponse.Me me = service.ranking(ME, CHART, 0, 3).me();

        assertThat(me.inRanking()).isTrue();
        assertThat(me.rank()).isEqualTo(7);   // 앞에 6명 -> 7위. 페이지(첫 페이지, size 3)와 상관없다
        assertThat(me.achievementRate()).isEqualByComparingTo("96.12");
        assertThat(me.stage()).isEqualTo(AchievementStage.SS);
    }

    @Test
    void 내가_비공개이면_순위에_없다고만_알리고_달성률을_내려주지_않는다() {
        when(userRepository.findById(ME)).thenReturn(Optional.of(viewer(false)));
        when(mapper.countPlayers(CHART, SRN_PLUS)).thenReturn(3L);
        when(mapper.findPage(CHART, SRN_PLUS, 20, 0L)).thenReturn(List.of(row(1, "90.00", false)));

        SongRankingResponse.Me me = service.ranking(ME, CHART, 0, 20).me();

        assertThat(me.inRanking()).isFalse();
        assertThat(me.rank()).isNull();
        assertThat(me.achievementRate()).isNull();
        assertThat(me.stage()).isNull();
        // 비공개인 나의 기록은 조회하지도 않는다
        verify(mapper, never()).findMine(anyLong(), any(), anyLong());
        verify(mapper, never()).countAhead(anyLong(), any(), any(), any(), anyLong());
    }

    @Test
    void 사용자가_없거나_차단된_상태여도_순위에_없는_것으로_본다() {
        User blocked = viewer(true);
        blocked.block();
        when(userRepository.findById(ME)).thenReturn(Optional.of(blocked));
        when(mapper.countPlayers(CHART, SRN_PLUS)).thenReturn(0L);
        when(mapper.findPage(CHART, SRN_PLUS, 20, 0L)).thenReturn(List.of());

        assertThat(service.ranking(ME, CHART, 0, 20).me().inRanking()).isFalse();
    }
}
