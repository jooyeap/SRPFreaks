package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.PlayerDetailResponse;
import com.srpfreaks.backend.dto.PlayerSummaryResponse;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 유저 목록과 유저 상세 (D26). 본인이 공개를 켠 ACTIVE 유저만 대상이고 읽기 전용이다.
 *
 * 점수는 새로 만든 수식이 아니라 SkillService.mySkill(userId)를 그대로 쓴다. 그래서 목록·상세의 숫자는
 * 그 유저가 자기 레이팅 화면에서 보는 숫자와 항상 같다(계산 규칙이 한 곳에만 있다).
 *
 * 성능: 공개 유저마다 레이팅을 계산한 뒤 메모리에서 정렬·페이지로 자른다. 공개 유저 수가 수십~수백인 지금은 충분하지만,
 * 느려지면 캐시나 스냅샷 테이블을 검토한다(DESIGN.md 18.2에 같은 방침이 있다).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlayerService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;

    private final UserRepository userRepository;
    private final SkillService skillService;

    /**
     * 총점 내림차순. 총점이 같으면 "먼저 달성한 사람이 위"다: 레이팅 목록에 들어간 채보들의 달성 시각 중 가장 늦은 시각이
     * 더 이른 쪽이 위(그 점수 세트를 더 일찍 완성한 사람). 시각까지 같거나 둘 다 없으면 user_id가 작은 쪽이 위라서
     * 순서가 요청마다 바뀌지 않는다.
     */
    public PageResponse<PlayerSummaryResponse> list(int page, int size) {
        List<Ranked> ranked = userRepository.findByProfilePublicTrueAndStatus(UserStatus.ACTIVE).stream()
                // 공개는 닉네임이 있을 때만 켤 수 있지만, 데이터가 어긋난 경우에도 이름 없는 줄은 내보내지 않는다
                .filter(user -> user.getNickname() != null)
                .map(user -> new Ranked(user, skillService.rated(user.getId())))
                .sorted(Comparator.comparing((Ranked r) -> r.rated().skill().totalScore()).reversed()
                        .thenComparing(Ranked::lastAchievedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(r -> r.user().getId()))
                .toList();

        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        int from = (int) Math.min((long) pageIndex * pageSize, ranked.size());
        int to = Math.min(from + pageSize, ranked.size());

        List<PlayerSummaryResponse> content = new ArrayList<>();
        for (int i = from; i < to; i++) {
            Ranked r = ranked.get(i);
            // 순위는 정렬된 전체 목록에서의 위치(1부터)라서 2페이지의 첫 줄은 pageSize + 1위다
            content.add(new PlayerSummaryResponse(r.user().getId(), i + 1, r.user().getNickname(),
                    r.rated().skill().tier(), r.rated().skill().totalScore()));
        }
        int totalPages = (ranked.size() + pageSize - 1) / pageSize;
        return new PageResponse<>(content, pageIndex, pageSize, ranked.size(), totalPages);
    }

    /**
     * 공개한 ACTIVE 유저의 상세. 비공개·차단·없는 유저는 구분하지 않고 모두 404다(존재 여부를 알려 주지 않는다).
     */
    public PlayerDetailResponse detail(Long userId) {
        User user = userRepository.findByIdAndProfilePublicTrueAndStatus(userId, UserStatus.ACTIVE)
                .filter(u -> u.getNickname() != null)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        return new PlayerDetailResponse(user.getId(), user.getNickname(), skillService.mySkill(user.getId()));
    }

    /** 정렬용으로 유저와 계산 결과를 잠깐 묶어 두는 내부용 값. */
    private record Ranked(User user, SkillService.RatedSkill rated) {

        LocalDateTime lastAchievedAt() {
            return rated.lastAchievedAt();
        }
    }
}
