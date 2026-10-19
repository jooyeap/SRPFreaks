package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.repository.AppSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 내 레이팅 목록(단일 + 그 외 최대 40채보)의 기준 난이도 평균으로 추정한다(둘째 자리까지 반올림).
 * - 목록이 비어 있으면 NEW_PLAYER.
 * - 단일 또는 그 외 채보 수가 setlist.recommend_min_single / min_other보다 적으면 INSUFFICIENT
 *   (한쪽만 채워진 목록의 평균은 실력대를 대표하지 못한다).
 * 레이팅 목록은 요청 때마다 계산하는 값이고(D3), 여기서도 저장하지 않는다.
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OwnRatingPlayLevelEstimator implements PlayLevelEstimator {

    private final SkillService skillService;
    private final AppSettingRepository appSettingRepository;

    @Override
    public PlayLevelEstimate estimate(Long userId) {
        SetlistRecommendConfig config = SetlistRecommendConfig.from(appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue)));
        SkillResponse skill = skillService.mySkill(userId);
        List<BigDecimal> single = tiers(skill.single());
        List<BigDecimal> other = tiers(skill.other());
        if (single.isEmpty() && other.isEmpty()) {
            return PlayLevelEstimate.newPlayer();
        }
        if (single.size() < config.minSingle() || other.size() < config.minOther()) {
            return PlayLevelEstimate.insufficient(single.size(), other.size());
        }
        BigDecimal sum = Stream.concat(single.stream(), other.stream()).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal average = sum.divide(BigDecimal.valueOf(single.size() + other.size()), 2, RoundingMode.HALF_UP);
        return PlayLevelEstimate.ready(average, single.size(), other.size());
    }

    private static List<BigDecimal> tiers(List<SkillEntryResponse> entries) {
        return entries.stream().map(SkillEntryResponse::tier).filter(t -> t != null).toList();
    }
}
