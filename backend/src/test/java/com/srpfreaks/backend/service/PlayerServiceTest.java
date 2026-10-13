package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.PlayerDetailResponse;
import com.srpfreaks.backend.dto.PlayerSummaryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import com.srpfreaks.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 유저 목록·상세 (D26). 점수 계산은 SkillService가 하고(SkillServiceTest가 검증), 여기서는
 * 정렬(총점 내림차순, 동점은 user_id 오름차순), 순위, 페이지, 노출 범위(공개한 ACTIVE 유저만, 없으면 404)를 확인한다.
 */
@ExtendWith(MockitoExtension.class)
class PlayerServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    SkillService skillService;

    @InjectMocks
    PlayerService service;

    /** id를 직접 정한 공개 유저. id는 DB가 만들어 주는 값이라 리플렉션으로 넣는다. */
    private User publicUser(long id, String nickname) {
        User user = User.create("sub-" + id, "u" + id + "@example.com", nickname);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private SkillResponse skill(String total) {
        BigDecimal score = new BigDecimal(total);
        return new SkillResponse(NoteOption.SUPER_RANDOM_PLUS, score, score, BigDecimal.ZERO,
                new PlayerTierResponse("WHITE", "White", 0, "Gray", 500), 15, 25, List.of(), List.of());
    }

    private static final java.time.LocalDateTime T1 = java.time.LocalDateTime.of(2026, 10, 1, 12, 0);
    private static final java.time.LocalDateTime T2 = java.time.LocalDateTime.of(2026, 10, 2, 12, 0);

    private SkillService.RatedSkill rated(String total, java.time.LocalDateTime lastAchievedAt) {
        return new SkillService.RatedSkill(skill(total), lastAchievedAt);
    }

    private void givenPublicUsers(User... users) {
        when(userRepository.findByProfilePublicTrueAndStatus(UserStatus.ACTIVE)).thenReturn(List.of(users));
    }

    @Test
    void 총점이_높은_순으로_순위를_매기고_총점과_시각이_모두_같으면_user_id가_작은_쪽이_위다() {
        User a = publicUser(1, "あか");
        User b = publicUser(2, "あお");
        User c = publicUser(3, "みどり");
        givenPublicUsers(c, b, a); // 저장소가 주는 순서와 결과 순서는 무관해야 한다
        when(skillService.rated(1L)).thenReturn(rated("100.00", T1));
        when(skillService.rated(2L)).thenReturn(rated("300.00", T2));
        when(skillService.rated(3L)).thenReturn(rated("100.00", T1)); // 1번과 총점·시각이 모두 같다 -> user_id가 작은 1번이 위

        PageResponse<PlayerSummaryResponse> result = service.list(0, 20);

        assertThat(result.content()).extracting(PlayerSummaryResponse::userId).containsExactly(2L, 1L, 3L);
        assertThat(result.content()).extracting(PlayerSummaryResponse::rank).containsExactly(1, 2, 3);
        assertThat(result.content().get(0).nickname()).isEqualTo("あお");
        assertThat(result.content().get(0).totalScore()).isEqualByComparingTo("300.00");
        assertThat(result.content().get(0).tier().displayName()).isEqualTo("White");
    }

    @Test
    void 페이지로_자르고_순위는_전체_기준으로_이어진다() {
        User[] users = new User[5];
        for (int i = 0; i < 5; i++) {
            users[i] = publicUser(i + 1, "ユーザー" + (i + 1));
            when(skillService.rated((long) (i + 1))).thenReturn(rated(String.valueOf(500 - i * 100) + ".00", T1));
        }
        givenPublicUsers(users);

        PageResponse<PlayerSummaryResponse> second = service.list(1, 2);

        assertThat(second.content()).extracting(PlayerSummaryResponse::userId).containsExactly(3L, 4L);
        assertThat(second.content()).extracting(PlayerSummaryResponse::rank).containsExactly(3, 4); // 2페이지 첫 줄은 3위
        assertThat(second.page()).isEqualTo(1);
        assertThat(second.size()).isEqualTo(2);
        assertThat(second.totalElements()).isEqualTo(5);
        assertThat(second.totalPages()).isEqualTo(3);
    }

    @Test
    void 범위를_벗어난_페이지는_빈_목록이고_크기_상한과_하한을_지킨다() {
        User a = publicUser(1, "あか");
        givenPublicUsers(a);
        when(skillService.rated(1L)).thenReturn(rated("10.00", T1));

        assertThat(service.list(5, 20).content()).isEmpty();
        assertThat(service.list(-3, 20).content()).hasSize(1);                         // 음수 페이지는 0으로
        assertThat(service.list(0, 0).size()).isEqualTo(1);                             // 0 이하 크기는 1로
        assertThat(service.list(0, 9999).size()).isEqualTo(PlayerService.MAX_PAGE_SIZE); // 상한
    }

    @Test
    void 공개한_유저가_없으면_빈_목록이다() {
        givenPublicUsers();

        PageResponse<PlayerSummaryResponse> result = service.list(0, 20);

        assertThat(result.content()).isEmpty();
        assertThat(result.totalElements()).isZero();
        assertThat(result.totalPages()).isZero();
    }

    @Test
    void 닉네임이_없는_유저는_공개로_남아_있어도_내보내지_않는다() {
        User named = publicUser(1, "あか");
        User nameless = publicUser(2, null);
        givenPublicUsers(named, nameless);
        when(skillService.rated(1L)).thenReturn(rated("10.00", T1));

        PageResponse<PlayerSummaryResponse> result = service.list(0, 20);

        assertThat(result.content()).extracting(PlayerSummaryResponse::userId).containsExactly(1L);
        verify(skillService, never()).rated(2L); // 계산도 하지 않는다
    }

    @Test
    void 목록_응답에는_이메일_역할_Google_ID_필드가_없다() {
        Set<String> fields = Arrays.stream(PlayerSummaryResponse.class.getRecordComponents())
                .map(RecordComponent::getName).collect(Collectors.toSet());

        assertThat(fields).containsExactlyInAnyOrder("userId", "rank", "nickname", "tier", "totalScore");
    }

    @Test
    void 상세는_공개한_유저의_닉네임과_레이팅을_준다() {
        User user = publicUser(7, "あか");
        when(userRepository.findByIdAndProfilePublicTrueAndStatus(7L, UserStatus.ACTIVE)).thenReturn(Optional.of(user));
        SkillResponse skill = skill("123.45");
        when(skillService.mySkill(7L)).thenReturn(skill);

        PlayerDetailResponse detail = service.detail(7L);

        assertThat(detail.userId()).isEqualTo(7L);
        assertThat(detail.nickname()).isEqualTo("あか");
        assertThat(detail.skill()).isSameAs(skill);
    }

    @Test
    void 비공개_차단_없는_유저의_상세는_모두_똑같이_404다() {
        // 저장소가 공개+ACTIVE 조건으로만 찾으므로, 어떤 이유든 못 찾으면 빈 값이다 (존재 여부를 구분하지 않는다)
        when(userRepository.findByIdAndProfilePublicTrueAndStatus(9L, UserStatus.ACTIVE)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail(9L))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(skillService, never()).mySkill(9L);
    }

    @Test
    void 닉네임이_없는_유저의_상세도_404다() {
        User nameless = publicUser(8, null);
        when(userRepository.findByIdAndProfilePublicTrueAndStatus(8L, UserStatus.ACTIVE)).thenReturn(Optional.of(nameless));

        assertThatThrownBy(() -> service.detail(8L))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    void 총점이_같으면_마지막_달성_시각이_이른_사람이_위다() {
        User early = publicUser(5, "はやい");
        User late = publicUser(2, "おそい");   // user_id는 더 작지만 늦게 달성했다
        givenPublicUsers(late, early);
        when(skillService.rated(5L)).thenReturn(rated("100.00", T1));
        when(skillService.rated(2L)).thenReturn(rated("100.00", T2));

        PageResponse<PlayerSummaryResponse> result = service.list(0, 20);

        assertThat(result.content()).extracting(PlayerSummaryResponse::userId).containsExactly(5L, 2L);
    }

    @Test
    void 총점이_다르면_달성_시각과_상관없이_총점이_높은_사람이_위다() {
        User high = publicUser(1, "たかい");
        User low = publicUser(2, "ひくい");
        givenPublicUsers(low, high);
        when(skillService.rated(1L)).thenReturn(rated("200.00", T2));   // 늦게 달성했어도 점수가 높다
        when(skillService.rated(2L)).thenReturn(rated("100.00", T1));

        assertThat(service.list(0, 20).content()).extracting(PlayerSummaryResponse::userId).containsExactly(1L, 2L);
    }

    @Test
    void 달성_시각이_없는_사람은_같은_총점에서_시각이_있는_사람_뒤로_간다() {
        User none = publicUser(1, "なし");      // 목록이 비어 시각이 null (총점 0)
        User some = publicUser(2, "あり");
        givenPublicUsers(none, some);
        when(skillService.rated(1L)).thenReturn(rated("0.00", null));
        when(skillService.rated(2L)).thenReturn(rated("0.00", T1));

        assertThat(service.list(0, 20).content()).extracting(PlayerSummaryResponse::userId).containsExactly(2L, 1L);
    }
}
