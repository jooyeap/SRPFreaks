package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.mapper.PeerChartCount;
import com.srpfreaks.backend.mapper.PeerStatsMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 추천의 "비슷한 실력대가 레이팅에 반영한 곡" 근거(D89). 같은 티어 유저 기록(D53)과 같은 구간·같은 기준(peer.*)을 쓴다.
 *
 * 흐름: 내 티어 구간을 구한다 -> 구간 인원(공개 유저, 나 제외)이 peer.min_band_users 미만이면 근거 없음
 *       -> 채보마다 레이팅 목록에 넣은 인원을 세어 peer.min_chart_users 이상인 채보만 남긴다.
 * 내 레이팅 목록의 채보 id도 함께 돌려준다: 이미 레이팅에 든 채보는 "새로 반영할 곡"이 아니라서 근거 있는 추천에서 뺀다.
 * 응답에는 인원 수와 채보 id뿐이다(유저 식별 정보 없음). 근거가 없는 경우(티어 없음·구간 인원 부족)는 예외 없이 빈 결과다 -> 추천은 기존 방식으로 대체된다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PeerRecommendEvidence {

    /** usersByChart: 기준 인원 이상인 채보의 반영 인원. myRatedIds: 지금 내 레이팅 목록(단일+그 외)에 있는 채보. */
    public record Evidence(Map<Long, Integer> usersByChart, Set<Long> myRatedIds) {
        public static final Evidence NONE = new Evidence(Map.of(), Set.of());
    }

    private final AppSettingRepository appSettingRepository;
    private final SkillService skillService;
    private final PeerStatsMapper mapper;

    public Evidence of(Long userId) {
        Map<String, String> settings = appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
        RatingConfig ratingConfig = RatingConfig.from(settings);
        PeerStatsConfig config = PeerStatsConfig.from(settings);

        SkillResponse mine = skillService.mySkill(userId);
        PlayerTierResponse tier = mine.tier();
        if (tier == null) {
            return Evidence.NONE;
        }
        BigDecimal[] bounds = PeerStatsService.bandBounds(tier);
        String option = ratingConfig.noteOption().name();
        if (mapper.countBandUsers(userId, option, bounds[0], bounds[1]) < config.minBandUsers()) {
            return Evidence.NONE;
        }
        Map<Long, Integer> counts = mapper.countChartUsers(userId, option, bounds[0], bounds[1], config.minChartUsers()).stream()
                .collect(Collectors.toMap(PeerChartCount::songDifficultyId, PeerChartCount::users, (a, b) -> a));
        Set<Long> mineIds = Stream.concat(mine.single().stream(), mine.other().stream())
                .map(SkillEntryResponse::songDifficultyId)
                .collect(Collectors.toCollection(HashSet::new));
        return new Evidence(counts, mineIds);
    }
}
