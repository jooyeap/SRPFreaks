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
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 내 레이팅 목록(단일 + 그 외 최대 40채보)의 기준 난이도 평균으로 추정한다(둘째 자리까지 반올림).
 * 목록의 채보 수가 setlist.recommend_min_entries보다 적으면 추정하지 않는다(몇 곡만으로 평균을 내면 흔들린다).
 * 레이팅 목록은 요청 때마다 계산하는 값이고(D3), 여기서도 저장하지 않는다.
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OwnRatingPlayLevelEstimator implements PlayLevelEstimator {

    private final SkillService skillService;
    private final AppSettingRepository appSettingRepository;

    @Override
    public Optional<BigDecimal> estimate(Long userId) {
        SetlistRecommendConfig config = SetlistRecommendConfig.from(appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue)));
        SkillResponse skill = skillService.mySkill(userId);
        List<BigDecimal> tiers = Stream.concat(skill.single().stream(), skill.other().stream())
                .map(SkillEntryResponse::tier)
                .filter(t -> t != null)
                .toList();
        if (tiers.isEmpty() || tiers.size() < config.minEntries()) {
            return Optional.empty();
        }
        BigDecimal sum = tiers.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return Optional.of(sum.divide(BigDecimal.valueOf(tiers.size()), 2, RoundingMode.HALF_UP));
    }
}
