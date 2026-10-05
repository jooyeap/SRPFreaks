package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.LabeledEnum;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.PlayerTier;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.RatingCandidate;
import com.srpfreaks.backend.mapper.SkillMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.PlayerTierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 내 레이팅 목록 계산. 값은 저장하지 않고 요청 때마다 계산한다 (D3).
 *
 * 흐름: 설정 읽기 -> 레이팅 서열표 찾기 -> (MyBatis) 후보 채보 조회 -> 채보마다 R, V, 점수 계산
 *       -> 단일 / 그 외로 나눠 V 높은 순 상위 N개 -> 합계 -> 플레이어 티어.
 *
 * 규칙 요약 (CLAUDE.md "스킬 계산 규칙")
 * - 곡당 1채보로 거르지 않는다. 같은 곡의 다른 채보도 각각 후보다.
 * - 기준 난이도·속성이 없거나 '레이팅 제외'인 채보는 쿼리 단계에서 이미 빠진다.
 * - 목록이 모자라면(후보가 N개보다 적으면) 있는 만큼만 합산한다.
 * - userId는 토큰에서만 온다. 다른 사용자의 목록을 조회할 방법이 없다(랭킹·비교는 보류, D15).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SkillService {

    private final AppSettingRepository appSettingRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final PlayerTierRepository playerTierRepository;
    private final SkillMapper skillMapper;

    public SkillResponse mySkill(Long userId) {
        RatingConfig config = RatingConfig.from(ratingSettings());
        RatingCalculator calculator = new RatingCalculator(config);

        List<Scored> scored = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(config.noteOption(), TableStatus.ACTIVE)
                .map(table -> score(userId, config, calculator, table))
                .orElseGet(List::of);   // 레이팅 서열표가 아직 없으면 빈 목록

        List<Scored> single = top(scored, true, config.listSingle());
        List<Scored> other = top(scored, false, config.listOther());
        // 합계는 반올림하지 않은 점수로 더하고(D20), 화면에 내보낼 때만 둘째 자리로 반올림한다.
        BigDecimal singleScore = sum(single);
        BigDecimal otherScore = sum(other);
        BigDecimal total = singleScore.add(otherScore);

        return new SkillResponse(config.noteOption(), RatingCalculator.display(total),
                RatingCalculator.display(singleScore), RatingCalculator.display(otherScore), playerTier(total),
                config.listSingle(), config.listOther(), toResponses(single), toResponses(other));
    }

    /** rating.* 설정만 맵으로 모은다(설정 테이블은 작아서 전부 읽어도 가볍다). */
    private Map<String, String> ratingSettings() {
        return appSettingRepository.findAll().stream()
                .filter(s -> s.getKey().startsWith(RatingConfig.KEY_PREFIX))
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
    }

    private List<Scored> score(Long userId, RatingConfig config, RatingCalculator calc, DifficultyTable table) {
        List<RatingCandidate> candidates = skillMapper.findRatingCandidates(
                userId, config.noteOption().name(), table.getId(), PatternType.EXCLUDED.getLabel());
        List<Scored> result = new ArrayList<>();
        for (RatingCandidate c : candidates) {
            PatternType pattern = parsePattern(c.pattern());
            if (pattern == null || pattern == PatternType.EXCLUDED || c.tier() == null) {
                continue;   // 쿼리가 이미 거르지만, 값이 이상할 때 방어적으로 한 번 더 제외한다
            }
            BigDecimal constant = calc.constant(c.tier());
            BigDecimal value = calc.value(constant, c.bestRate());
            result.add(new Scored(c, pattern, constant, value, calc.score(value)));
        }
        return result;
    }

    /**
     * 한 그룹(단일 또는 그 외)에서 V 높은 순으로 limit개를 뽑는다.
     * V가 같으면 채보 id가 작은 쪽이 먼저다(순서가 요청마다 바뀌지 않게 하는 고정 기준, DESIGN.md 7장).
     */
    private static List<Scored> top(List<Scored> all, boolean singleGroup, int limit) {
        return all.stream()
                .filter(s -> (s.pattern() == PatternType.SINGLE) == singleGroup)
                .sorted(Comparator.comparing(Scored::value).reversed()
                        .thenComparing(s -> s.candidate().songDifficultyId()))
                .limit(limit)
                .toList();
    }

    private static List<SkillEntryResponse> toResponses(List<Scored> group) {
        List<SkillEntryResponse> rows = new ArrayList<>();
        for (int i = 0; i < group.size(); i++) {
            rows.add(toResponse(i + 1, group.get(i)));
        }
        return rows;
    }

    private static SkillEntryResponse toResponse(int rank, Scored s) {
        RatingCandidate c = s.candidate();
        return new SkillEntryResponse(rank, c.songDifficultyId(), c.songId(), c.title(),
                InstrumentPart.valueOf(c.part()), DifficultyType.valueOf(c.difficulty()), c.level(), c.tier(),
                s.pattern().getLabel(), c.bestRate(), c.fullCombo(),
                AchievementStage.of(c.bestRate(), c.fullCombo()), s.constant(),
                s.value().setScale(4, RoundingMode.HALF_UP), RatingCalculator.display(s.score()));
    }

    private static BigDecimal sum(List<Scored> group) {
        return group.stream().map(Scored::score).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * 플레이어 티어: 합계(반올림하지 않은 값)의 정수부(소수 버림)가 min_score 이상인 구간 중 가장 높은 것.
     * 구간표가 비어 있으면 null. 티어는 저장하지 않고 계산한다.
     */
    private PlayerTierResponse playerTier(BigDecimal total) {
        int floor = total.setScale(0, RoundingMode.DOWN).intValue();
        List<PlayerTier> tiers = playerTierRepository.findAllByOrderBySortOrderAsc().stream()
                .sorted(Comparator.comparingInt(PlayerTier::getMinScore))
                .toList();
        PlayerTier current = null;
        PlayerTier next = null;
        for (PlayerTier t : tiers) {
            if (t.getMinScore() <= floor) {
                current = t;
            } else if (next == null) {
                next = t;
            }
        }
        if (current == null) {
            return null;
        }
        return new PlayerTierResponse(current.getTierKey(), current.getDisplayName(), current.getMinScore(),
                next == null ? null : next.getDisplayName(), next == null ? null : next.getMinScore());
    }

    private static PatternType parsePattern(String label) {
        if (label == null) {
            return null;
        }
        try {
            return LabeledEnum.fromLabel(PatternType.class, label);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** 계산 결과를 잠깐 들고 다니는 내부용 묶음. */
    private record Scored(RatingCandidate candidate, PatternType pattern, BigDecimal constant,
                          BigDecimal value, BigDecimal score) {
    }
}
