package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SongRankingResponse;
import com.srpfreaks.backend.dto.SongRankingResponse.Item;
import com.srpfreaks.backend.dto.SongRankingResponse.Me;
import com.srpfreaks.backend.dto.SongRankingResponse.Tier;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.RankingRow;
import com.srpfreaks.backend.mapper.SongRankingMapper;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 곡별 순위 (D74). 채보 하나의 공개 유저 순위를 돌려준다. 읽기 전용이고 아무것도 저장하지 않는다(순위·인원은 요청 때 계산한다, D3).
 *
 * 흐름: 채보가 있는지 확인(없거나 삭제됐으면 404) -> 인원(공개 유저 수) -> 한 페이지 -> 내 순위(me).
 *
 * 개인정보: 인원 기준이 없어서(1명이어도 표시) 비공개 유저를 지키는 장치는 "공개 유저만으로 계산한다"는 규칙 하나다.
 * 순위 번호·인원·내 앞 사람 수가 전부 SongRankingMapper의 같은 조각(공개 + ACTIVE)에서 나오므로 비공개 유저가 번호나 인원으로 드러나지 않는다.
 * 비공개인 나에게는 내 달성률을 내려주지 않고 "순위에 없음"만 알린다.
 *
 * 순위 번호는 겹치지 않는다(공동 순위 없음). 동점은 mapper의 정렬이 정한다: 달성률 -> 먼저 저장한 시각(created_at) -> user_id.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SongRankingService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;

    private final SongDifficultyRepository songDifficultyRepository;
    private final UserRepository userRepository;
    private final SongRankingMapper rankingMapper;
    private final SkillService skillService;

    public SongRankingResponse ranking(Long viewerId, Long songDifficultyId, int page, int size) {
        songDifficultyRepository.findByIdAndDeletedFalse(songDifficultyId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        // 기록 옵션은 레이팅과 같은 설정 값(SRN+, D25)을 쓴다. 한 곳에서만 정한다.
        String option = skillService.ratingConfig().noteOption().name();

        // 범위를 벗어난 값은 오류 대신 안전한 값으로 맞춘다(유저 목록 PlayerService와 같은 방식)
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        long offset = (long) pageIndex * pageSize;

        long players = rankingMapper.countPlayers(songDifficultyId, option);
        List<RankingRow> rows = rankingMapper.findPage(songDifficultyId, option, pageSize, offset);

        // 닉네임 글자색용 티어. 이 페이지에 나온 유저(공개 + ACTIVE)만 한 번에 계산한다: ratedAll은 설정·서열표·티어 구간표를 요청당 한 번만 읽고
        // 유저마다 후보 쿼리 한 번씩만 돈다(유저 목록 PlayerService와 같은 코드라 숫자가 어긋날 수 없다). 페이지 크기 상한이 50이라 많아야 50명이다.
        Map<Long, SkillService.RatedSkill> rated = skillService.ratedAll(rows.stream().map(RankingRow::userId).toList());

        List<Item> items = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            RankingRow row = rows.get(i);
            // 순위 = 정렬된 전체 목록에서의 위치(1부터). 2페이지의 첫 줄은 pageSize + 1위다. 비공개 유저는 목록에 없으므로 번호가 건너뛰지 않는다.
            items.add(new Item((int) offset + i + 1, row.userId(), row.nickname(), row.bestRate(),
                    AchievementStage.of(row.bestRate(), row.fullCombo()), row.userId().equals(viewerId), tierOf(rated.get(row.userId()))));
        }
        int totalPages = (int) ((players + pageSize - 1) / pageSize);
        return new SongRankingResponse(songDifficultyId, players, pageIndex, pageSize, totalPages,
                me(viewerId, songDifficultyId, option), items);
    }

    /**
     * 내 순위. 내 앞 사람 수 + 1이다. 앞 사람 수도 같은 공개 조각에서 세므로 비공개 유저는 들어가지 않는다.
     * - 공개 유저가 아니면(비공개 등) 순위에 없다고만 알린다. 달성률은 내려주지 않는다.
     * - 공개 유저인데 기록이 없으면 null.
     */
    private Me me(Long viewerId, Long songDifficultyId, String option) {
        User viewer = userRepository.findById(viewerId).orElse(null);
        if (viewer == null || !viewer.isProfilePublic() || !viewer.isActive() || viewer.getNickname() == null) {
            return Me.notInRanking();
        }
        RankingRow mine = rankingMapper.findMine(songDifficultyId, option, viewerId);
        if (mine == null) {
            return null;
        }
        long ahead = rankingMapper.countAhead(songDifficultyId, option, mine.bestRate(), mine.achievedAt(), viewerId);
        return Me.of((int) ahead + 1, mine.bestRate(), AchievementStage.of(mine.bestRate(), mine.fullCombo()));
    }

    /** 티어를 정할 수 없으면(계산 결과가 없거나 티어 구간표가 비어 있을 때) null. 화면은 null이면 기본 글자색을 쓴다. */
    private static Tier tierOf(SkillService.RatedSkill rated) {
        if (rated == null || rated.skill() == null) {
            return null;
        }
        PlayerTierResponse tier = rated.skill().tier();
        return tier == null ? null : new Tier(tier.key(), tier.displayName());
    }
}
