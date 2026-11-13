package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.NotRatedReason;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.LabeledEnum;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.PlayerTier;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.ChartRatingRow;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
        return rated(userId).skill();
    }

    /**
     * 레이팅 목록 + "마지막 달성 시각"(유저 목록 동점 처리용, D26).
     * lastAchievedAt = 레이팅 목록(단일 + 그 외)에 들어간 채보들의 달성 시각 중 가장 늦은 것. 목록이 비면 null.
     * "그 점수 세트를 완성한 시각"이라서, 같은 총점이면 더 일찍 완성한 사람이 먼저다. API 응답에는 내보내지 않는다.
     */
    public RatedSkill rated(Long userId) {
        return ratedAll(List.of(userId)).get(userId);
    }

    /**
     * 여러 유저의 레이팅을 한 번에 계산한다 (유저 목록용).
     *
     * 왜 따로 두는가: 설정(app_settings), 레이팅 서열표, 티어 구간표는 유저와 상관없이 같은 값이다.
     * 유저마다 rated()를 부르면 이 세 가지를 유저 수만큼 다시 읽는다(유저 N명이면 쿼리 약 4N번).
     * 여기서는 이 세 가지를 요청당 한 번만 읽고, 유저마다 달라지는 후보 채보 조회(MyBatis)만 반복한다.
     * 계산 규칙은 rated()와 같은 코드(rateOne)를 쓰므로 숫자가 달라질 수 없다.
     */
    public Map<Long, RatedSkill> ratedAll(Collection<Long> userIds) {
        Map<Long, RatedSkill> result = new LinkedHashMap<>();
        if (userIds.isEmpty()) {
            return result;
        }
        RatingConfig config = RatingConfig.from(ratingSettings());
        RatingCalculator calculator = new RatingCalculator(config);
        Optional<DifficultyTable> table = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(config.noteOption(), TableStatus.ACTIVE);
        List<PlayerTier> tiers = playerTierRepository.findAllByOrderBySortOrderAsc().stream()
                .sorted(Comparator.comparingInt(PlayerTier::getMinScore))
                .toList();
        for (Long userId : userIds) {
            result.put(userId, rateOne(userId, config, calculator, table, tiers));
        }
        return result;
    }

    private RatedSkill rateOne(Long userId, RatingConfig config, RatingCalculator calculator,
                               Optional<DifficultyTable> table, List<PlayerTier> tiers) {
        List<Scored> scored = table
                .map(t -> score(userId, config, calculator, t))
                .orElseGet(List::of);   // 레이팅 서열표가 아직 없으면 빈 목록

        List<Scored> single = top(scored, true, config.listSingle());
        List<Scored> other = top(scored, false, config.listOther());
        // 합계는 반올림하지 않은 점수로 더하고(D20), 화면에 내보낼 때만 둘째 자리로 반올림한다.
        BigDecimal singleScore = sum(single);
        BigDecimal otherScore = sum(other);
        BigDecimal total = singleScore.add(otherScore);

        SkillResponse response = new SkillResponse(config.noteOption(), RatingCalculator.display(total),
                RatingCalculator.display(singleScore), RatingCalculator.display(otherScore), playerTier(total, tiers),
                config.listSingle(), config.listOther(), toResponses(single), toResponses(other));
        return new RatedSkill(response, lastAchievedAt(single, other));
    }

    /** 뽑힌 채보들의 달성 시각 중 가장 늦은 것. 시각이 하나도 없으면 null. */
    private static LocalDateTime lastAchievedAt(List<Scored> single, List<Scored> other) {
        return Stream.concat(single.stream(), other.stream())
                .map(s -> s.candidate().achievedAt())
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    /** 레이팅 계산 결과와 동점 처리용 시각을 한 번에 돌려주는 값. */
    public record RatedSkill(SkillResponse skill, LocalDateTime lastAchievedAt) {
    }

    /**
     * 여러 유저의 "레이팅 대상 채보 전체"와 채보 점수를 한 번에 돌려준다(라이벌 대시보드 집계, D67).
     * 레이팅 목록(상위 단일 15 + 그 외 25)이 아니라, 기록이 있고 레이팅 후보 조건을 모두 만족하는 채보 전부다.
     * 대상 판정과 점수 수식은 {@link #ratedAll}과 같은 코드(score)를 쓰므로 목록 계산과 어긋날 수 없다.
     * 설정·레이팅 서열표는 요청당 한 번만 읽고, 유저마다 후보 쿼리(MyBatis) 한 번씩만 돈다(N+1 없음).
     */
    public Map<Long, List<ScoredChart>> scoredChartsAll(Collection<Long> userIds) {
        Map<Long, List<ScoredChart>> result = new LinkedHashMap<>();
        if (userIds.isEmpty()) {
            return result;
        }
        RatingConfig config = RatingConfig.from(ratingSettings());
        RatingCalculator calculator = new RatingCalculator(config);
        Optional<DifficultyTable> table = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(config.noteOption(), TableStatus.ACTIVE);
        for (Long userId : userIds) {
            List<ScoredChart> charts = table
                    .map(t -> score(userId, config, calculator, t).stream()
                            .map(s -> new ScoredChart(s.candidate(), s.pattern(), s.score()))
                            .toList())
                    .orElseGet(List::of);
            result.put(userId, charts);
        }
        return result;
    }

    /**
     * 레이팅 목록(단일 상위 N + 그 외 상위 M, 설정 rating.list_single/list_other) 40채보의 점수를 속성별로 더한 값(반올림하지 않음).
     * 입력은 {@link #scoredChartsAll}이 이미 읽은 "레이팅 대상 채보 전체"라서 새 쿼리가 없고, 목록 선정 규칙(그룹별 V 높은 순, 같으면 채보 id 작은 쪽)은
     * rateOne의 top()과 같다(점수 = V × 20으로 순서가 같다). 속성별 합을 모두 더하면 그 사람의 총점(레이팅 목록 합계)이다.
     * 라이벌 대시보드의 "속성별 점수 차"(내 합 - 상대 합)가 총점 차와 맞아떨어지게 하려는 값이다(D67 개정).
     */
    public Map<Long, Map<PatternType, BigDecimal>> ratingListScoreByPattern(Map<Long, List<ScoredChart>> charts) {
        RatingConfig config = RatingConfig.from(ratingSettings());
        Map<Long, Map<PatternType, BigDecimal>> result = new LinkedHashMap<>();
        charts.forEach((userId, list) -> {
            Map<PatternType, BigDecimal> sums = new java.util.EnumMap<>(PatternType.class);
            for (boolean singleGroup : new boolean[] {true, false}) {
                list.stream()
                        .filter(c -> (c.pattern().ratingGroup() == PatternType.RatingGroup.SINGLE) == singleGroup)
                        .sorted(Comparator.comparing(ScoredChart::score).reversed()
                                .thenComparing(c -> c.candidate().songDifficultyId()))
                        .limit(singleGroup ? config.listSingle() : config.listOther())
                        .forEach(c -> sums.merge(c.pattern(), c.score(), BigDecimal::add));
            }
            result.put(userId, sums);
        });
        return result;
    }

    /** 한 채보의 후보 정보 + 속성 + 반올림하지 않은 채보 점수(라이벌 대시보드 집계용, D67). */
    public record ScoredChart(RatingCandidate candidate, PatternType pattern, BigDecimal score) {
    }

    /** 레이팅이 쓰는 노트 옵션(설정 rating.note_option). 스냅샷 목록처럼 계산 없이 옵션만 필요할 때 쓴다. */
    public NoteOption ratingNoteOption() {
        return RatingConfig.from(ratingSettings()).noteOption();
    }

    /** 지금 설정으로 만든 레이팅 계산기. 레이팅 목록 밖의 채보 점수(라이벌 비교, D56)를 같은 수식으로 계산할 때 쓴다. */
    public RatingCalculator calculator() {
        return new RatingCalculator(RatingConfig.from(ratingSettings()));
    }

    /**
     * 채보 한 개의 내 레이팅 상태 (저장 결과 카드용). 후보 전체를 다시 계산하지 않고 이 채보 한 줄만 읽는다.
     * 점수는 목록 계산과 같은 RatingCalculator(상수 -> V -> 점수)로 구한다. 대상 판정은 후보 쿼리와 같은 조건이다:
     * 서열표에 없음/반영 끔/속성 없음·레이팅 제외 = EXCLUDED, 기준 난이도 없음 = TIER_UNDECIDED. 그룹 판정은 PatternType 한 곳.
     */
    public ChartRating chartRating(Long userId, Long chartId) {
        RatingConfig config = RatingConfig.from(ratingSettings());
        RatingCalculator calculator = new RatingCalculator(config);
        ChartRatingRow row = chartRatingRow(userId, chartId, config);
        if (row == null) {
            return new ChartRating(NotRatedReason.NOT_RATED, null, null, null);
        }
        BigDecimal score = row.tier() == null || row.bestRate() == null ? null
                : RatingCalculator.display(calculator.score(calculator.value(calculator.constant(row.tier()), row.bestRate())));
        PatternType.RatingGroup group = PatternType.ratingGroupOf(parsePattern(row.pattern()));
        NotRatedReason reason = notRatedReason(row);
        return new ChartRating(reason, reason == null ? group : null, row.bestRate(), score);
    }

    /**
     * 채보 한 개의 서열표 값 + 내 최고 달성률 한 줄 (chartRating과 레이팅 시뮬레이션이 같이 쓴다).
     * 레이팅 서열표가 아직 없으면 tableId가 null이라 "서열표에 없는 채보"로 읽힌다. 채보 자체가 없으면 null.
     */
    public ChartRatingRow chartRatingRow(Long userId, Long chartId, RatingConfig config) {
        Long tableId = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(config.noteOption(), TableStatus.ACTIVE)
                .map(DifficultyTable::getId).orElse(null);
        return skillMapper.findChartRating(userId, config.noteOption().name(), tableId, chartId);
    }

    /**
     * 레이팅 대상이 아닌 이유 (대상이면 null). 판정 기준은 후보 쿼리(findRatingCandidates)와 같다:
     * 서열표에 없음/반영 끔 = EXCLUDED, 기준 난이도 없음 = TIER_UNDECIDED, 속성 없음·레이팅 제외 = EXCLUDED.
     * 저장 결과 카드와 시뮬레이션이 같은 판정을 쓰도록 한 곳에 둔다.
     */
    public static NotRatedReason notRatedReason(ChartRatingRow row) {
        if (row.entryId() == null || !Boolean.TRUE.equals(row.ratingEnabled())) {
            return NotRatedReason.EXCLUDED;
        }
        if (row.tier() == null) {
            return NotRatedReason.TIER_UNDECIDED;
        }
        if (PatternType.ratingGroupOf(parsePattern(row.pattern())) == PatternType.RatingGroup.NONE) {
            return NotRatedReason.EXCLUDED;
        }
        return null;
    }

    /** 지금 설정(rating.*)으로 만든 레이팅 숫자들. 목록 개수(rating.list_single/list_other)를 읽을 때 쓴다. */
    public RatingConfig ratingConfig() {
        return RatingConfig.from(ratingSettings());
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
            if (PatternType.ratingGroupOf(pattern) == PatternType.RatingGroup.NONE || c.tier() == null) {
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
                .filter(s -> (s.pattern().ratingGroup() == PatternType.RatingGroup.SINGLE) == singleGroup)
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
     * 구간표가 비어 있으면 null. 티어는 저장하지 않고 계산한다. tiers는 min_score 오름차순이다.
     */
    private static PlayerTierResponse playerTier(BigDecimal total, List<PlayerTier> tiers) {
        int floor = total.setScale(0, RoundingMode.DOWN).intValue();
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
