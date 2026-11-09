package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RivalChartRow;
import com.srpfreaks.backend.dto.RivalCompareChartsResponse;
import com.srpfreaks.backend.dto.RivalCompareRatingResponse;
import com.srpfreaks.backend.dto.RivalCounts;
import com.srpfreaks.backend.dto.RivalRecordResponse;
import com.srpfreaks.backend.dto.RivalRegistrantResponse;
import com.srpfreaks.backend.dto.RivalResponse;
import com.srpfreaks.backend.dto.RivalStatusResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Rival;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import com.srpfreaks.backend.mapper.RatingCandidate;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.ChartBest;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RivalRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserBest;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 라이벌 등록·목록과 비교 화면(D56, 설계 DESIGN.md 18.2.1). 모두 로그인한 사용자만 부른다.
 *
 * 상대는 "공개한 ACTIVE 유저"여야 한다. 아니면(비공개·차단·없음) 구분하지 않고 404라서 존재 여부가 드러나지 않는다.
 * 승패는 저장하지 않고 볼 때 두 사람의 채보별 최고 기록(SRN+)으로 계산한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RivalService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;

    /** 곡별 승패 목록에서 고를 수 있는 결과(화이트리스트). */
    public enum Result { WIN, LOSE, TIE, THEIRS_ONLY }

    private final RivalRepository rivalRepository;
    private final UserRepository userRepository;
    private final OptionRecordRepository optionRecordRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final AppSettingRepository appSettingRepository;
    private final SkillService skillService;
    private final Clock clock;

    // ---------- 등록 ----------

    @Transactional
    public void register(Long userId, Long targetUserId) {
        if (userId.equals(targetUserId)) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        User target = findPublic(targetUserId);
        if (rivalRepository.existsByUser_IdAndTarget_Id(userId, targetUserId)) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        if (rivalRepository.countByUser_Id(userId) >= RivalConfig.load(appSettingRepository).maxCount()) {
            throw new ApiException(ErrorCode.RIVAL_LIMIT);
        }
        try {
            rivalRepository.saveAndFlush(Rival.of(userRepository.getReferenceById(userId), target, clock.instant()));
        } catch (DataIntegrityViolationException e) {
            // 같은 요청이 동시에 두 번 오면 UNIQUE(user_id, target_user_id)가 막는다 -> "이미 등록"과 같게 응답
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }

    /** 해제. 상대가 비공개가 됐어도 해제할 수 있어야 하므로 공개 여부를 보지 않는다. 없어도 성공(멱등). */
    @Transactional
    public void unregister(Long userId, Long targetUserId) {
        rivalRepository.deleteByUserAndTarget(userId, targetUserId);
    }

    public RivalStatusResponse status(Long userId, Long targetUserId) {
        findPublic(targetUserId);
        boolean registered = rivalRepository.existsByUser_IdAndTarget_Id(userId, targetUserId);
        boolean mutual = registered && rivalRepository.existsByUser_IdAndTarget_Id(targetUserId, userId);
        return new RivalStatusResponse(registered, mutual, (int) rivalRepository.countByUser_Id(userId),
                RivalConfig.load(appSettingRepository).maxCount());
    }

    /** 내 라이벌 목록(최대 5명이라 페이지 없음). 볼 수 있는 상대만 레이팅·승패를 계산한다. */
    public List<RivalResponse> list(Long userId) {
        List<Rival> rivals = rivalRepository.findWithTargetByUserId(userId);
        if (rivals.isEmpty()) {
            return List.of();
        }
        Set<Long> registeringMe = new HashSet<>(rivalRepository.findUserIdsRegistering(userId));
        List<Long> visibleIds = rivals.stream().map(Rival::getTarget).filter(RivalService::isVisible).map(User::getId).toList();
        List<Long> rateIds = new ArrayList<>(visibleIds);
        rateIds.add(userId);
        Map<Long, SkillService.RatedSkill> rated = skillService.ratedAll(rateIds);
        NoteOption option = skillService.ratingNoteOption();
        Map<Long, ChartBest> mine = bestsOf(userId, option);
        BigDecimal myTotal = rated.get(userId).skill().totalScore();

        List<RivalResponse> result = new ArrayList<>();
        for (Rival rival : rivals) {
            User target = rival.getTarget();
            boolean mutual = registeringMe.contains(target.getId());
            if (!isVisible(target)) {
                result.add(new RivalResponse(target.getId(), target.getNickname(), false, mutual, null, null, null, null));
                continue;
            }
            SkillResponse skill = rated.get(target.getId()).skill();
            result.add(new RivalResponse(target.getId(), target.getNickname(), true, mutual, skill.tier(), skill.totalScore(),
                    skill.totalScore().subtract(myTotal), counts(mine, bestsOf(target.getId(), option)),
                    topSongsOf(skill)));
        }
        return result;
    }

    /** 라이벌 카드의 "상대 상위 곡" 칸 수(3단계, D65). */
    static final int TOP_SONG_COUNT = 5;

    /**
     * 상대 레이팅 목록(단일 + 그 외)에서 점수가 높은 곡 최대 5곡. 이미 계산된 레이팅 목록(ratedAll)에서 뽑으므로 쿼리를 더하지 않고
     * 점수 수식도 복제하지 않는다(라이벌 목록 화면의 총점과 같은 채보·같은 점수다). 같은 곡의 다른 채보가 함께 들어 있으면
     * 높은 쪽 하나만 쓴다(재킷은 곡 단위라 같은 그림이 두 번 나오지 않게). 정렬은 채보 값(V) 내림차순, 같으면 채보 id가 작은 쪽
     * (레이팅 목록과 같은 고정 기준, DESIGN.md 7장)이라 요청마다 순서가 바뀌지 않는다.
     */
    static List<RivalResponse.RivalTopSong> topSongsOf(SkillResponse skill) {
        Comparator<SkillEntryResponse> order = Comparator.comparing(SkillEntryResponse::value).reversed()
                .thenComparing(SkillEntryResponse::songDifficultyId);
        Set<Long> seen = new HashSet<>();
        return Stream.concat(skill.single().stream(), skill.other().stream())
                .sorted(order)
                .filter(entry -> seen.add(entry.songId()))
                .limit(TOP_SONG_COUNT)
                .map(entry -> new RivalResponse.RivalTopSong(entry.songId(), entry.score()))
                .toList();
    }

    /**
     * 나를 라이벌로 등록한 공개 유저(D63). 항상 로그인한 본인 기준이라 다른 사람의 목록을 묻는 입구가 없다.
     * 비공개·차단·탈퇴 유저는 쿼리에서 이미 빠지고 count도 같은 조건이라, 숨겨진 사람 수는 어디에도 나오지 않는다.
     * 티어는 한 페이지(최대 50명)만 한 번에 계산하고, 서로 라이벌 여부는 내 라이벌 목록(최대 5명) 한 번으로 정한다.
     */
    public PageResponse<RivalRegistrantResponse> registeredMe(Long userId, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        Page<User> found = rivalRepository.findPublicRegistrants(userId, UserStatus.ACTIVE, PageRequest.of(pageIndex, pageSize));
        if (found.isEmpty()) {
            return PageResponse.of(found, u -> null);
        }
        Set<Long> mine = rivalRepository.findWithTargetByUserId(userId).stream()
                .map(r -> r.getTarget().getId()).collect(Collectors.toSet());
        Map<Long, SkillService.RatedSkill> rated = skillService.ratedAll(found.getContent().stream().map(User::getId).toList());
        return PageResponse.of(found, u -> new RivalRegistrantResponse(u.getId(), u.getNickname(),
                rated.get(u.getId()).skill().tier(), mine.contains(u.getId())));
    }

    // ---------- 비교 ----------

    /**
     * 상대 레이팅 목록에 내 점수를 나란히. 내 점수는 "그 채보가 내 레이팅 목록에 들어갔는지"와 상관없이
     * 상대 줄의 기준 난이도(T)로 레이팅 계산과 같은 수식(RatingCalculator)을 적용한 값이다.
     */
    public RivalCompareRatingResponse compareRating(Long userId, Long targetUserId) {
        User target = findComparable(userId, targetUserId);
        Map<Long, SkillService.RatedSkill> rated = skillService.ratedAll(List.of(targetUserId, userId));
        SkillResponse theirs = rated.get(targetUserId).skill();
        SkillResponse mySkill = rated.get(userId).skill();
        NoteOption option = skillService.ratingNoteOption();
        Map<Long, ChartBest> mine = bestsOf(userId, option);
        RatingCalculator calculator = skillService.calculator();
        Function<SkillEntryResponse, RivalCompareRatingResponse.Row> toRow = e -> {
            ChartBest my = mine.get(e.songDifficultyId());
            BigDecimal myScore = my == null ? null
                    : calculator.score(calculator.value(calculator.constant(e.tier()), my.bestRate()));
            BigDecimal myScoreShown = myScore == null ? null : RatingCalculator.display(myScore);
            return new RivalCompareRatingResponse.Row(e.rank(), e.songDifficultyId(), e.songId(), e.title(), e.part(),
                    e.difficulty(), e.level(), e.tier(), e.pattern(), e.achievementRate(), e.stage(), e.score(),
                    my == null ? null : my.bestRate(), myScoreShown, myScoreShown == null ? null : myScoreShown.subtract(e.score()));
        };
        return new RivalCompareRatingResponse(target.getId(), target.getNickname(), theirs.tier(), theirs.totalScore(),
                mySkill.tier(), mySkill.totalScore(), counts(mine, bestsOf(targetUserId, option)),
                theirs.single().stream().map(toRow).toList(), theirs.other().stream().map(toRow).toList());
    }

    /**
     * 곡별 승패 목록(D56, D67 개정). **라이벌 대시보드 집계와 같은 범위·같은 판정**이다: 두 사람이 모두 기록한 레이팅 대상 채보 전체를
     * 달성률 차(내 달성률 - 상대 달성률, 반올림 없음)로 가른다(승 > 0, 패 < 0, 무 = 0). 그래서 탭 개수(승·패·무)는 대시보드 totals와,
     * `상대만` 개수는 속성별 onlyTheirs 합과 항상 같다. 계산은 RivalSummaryCalculator를 그대로 쓰고(두 번 만들지 않는다) 여기서는
     * 결과 필터·정렬·페이지만 얹는다.
     * 정렬: 차이(절댓값) 작은 순 → 레벨 높은 순 → 채보 id. 상대만 기록 있는 줄은 상대 달성률 높은 순 → 레벨 높은 순 → 채보 id.
     * 두 사람의 레이팅 대상 채보는 각각 한 번씩 읽고(SkillService.scoredChartsAll, N+1 없음) 곡 정보는 그 후보에 이미 들어 있다.
     */
    public RivalCompareChartsResponse compareCharts(Long userId, Long targetUserId, String result, int page, int size) {
        Result wanted = parseResult(result);
        findComparable(userId, targetUserId);
        Map<Long, List<SkillService.ScoredChart>> charts = skillService.scoredChartsAll(List.of(userId, targetUserId));
        List<SkillService.ScoredChart> mine = charts.getOrDefault(userId, List.of());
        List<SkillService.ScoredChart> theirs = charts.getOrDefault(targetUserId, List.of());

        List<RivalSummaryCalculator.Shared> shared = RivalSummaryCalculator.share(mine, theirs).stream()
                .filter(s -> RivalSummaryCalculator.PATTERN_ORDER.contains(s.pattern())).toList();
        RivalSummaryCalculator.Unmatched unmatched = RivalSummaryCalculator.unmatched(mine, theirs);
        RivalSummaryResponse.Totals totals = RivalSummaryCalculator.totalsOf(shared);
        RivalCounts counts = new RivalCounts(totals.wins(), totals.losses(), totals.ties(),
                RivalSummaryCalculator.totalOnlyTheirs(unmatched), RivalSummaryCalculator.totalOnlyMine(unmatched));

        List<RivalChartRow> rows;
        if (wanted == Result.THEIRS_ONLY) {
            Set<Long> myIds = mine.stream().map(m -> m.candidate().songDifficultyId()).collect(Collectors.toSet());
            rows = theirs.stream()
                    .filter(t -> RivalSummaryCalculator.PATTERN_ORDER.contains(t.pattern()))
                    .filter(t -> !myIds.contains(t.candidate().songDifficultyId()))
                    .sorted(Comparator.comparing((SkillService.ScoredChart t) -> t.candidate().bestRate(), Comparator.reverseOrder())
                            .thenComparing((SkillService.ScoredChart t) -> t.candidate().level(), Comparator.reverseOrder())
                            .thenComparing(t -> t.candidate().songDifficultyId()))
                    .map(t -> chartRow(t.candidate(), null, null))
                    .toList();
        } else {
            rows = shared.stream()
                    .filter(s -> switch (wanted) {
                        case WIN -> RivalSummaryCalculator.matches(RivalSummaryCalculator.Filter.WIN, s);
                        case LOSE -> RivalSummaryCalculator.matches(RivalSummaryCalculator.Filter.LOSE, s);
                        case TIE -> RivalSummaryCalculator.isTie(s);
                        case THEIRS_ONLY -> false;
                    })
                    .sorted(RivalSummaryCalculator.comparator(RivalSummaryCalculator.Sort.CLOSE))
                    .map(s -> chartRow(s.chart(), s.mine().candidate().bestRate(), s.rateDiff()))
                    .toList();
        }

        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        int from = (int) Math.min((long) pageIndex * pageSize, rows.size());
        int to = Math.min(from + pageSize, rows.size());
        int totalPages = (rows.size() + pageSize - 1) / pageSize;
        return new RivalCompareChartsResponse(counts,
                new PageResponse<>(rows.subList(from, to), pageIndex, pageSize, rows.size(), totalPages));
    }

    /** 곡별 승패 한 줄: 후보(레이팅 대상 채보 + 상대 최고 달성률)에서 곡 정보를 그대로 옮긴다. myRate·diff는 상대만 있는 줄이면 null. */
    private static RivalChartRow chartRow(RatingCandidate c, BigDecimal myRate, BigDecimal diff) {
        return new RivalChartRow(c.songDifficultyId(), c.songId(), c.title(), InstrumentPart.valueOf(c.part()),
                DifficultyType.valueOf(c.difficulty()), c.level(), myRate, c.bestRate(), diff);
    }

    /** 곡 상세의 라이벌 기록: 이 채보에 대한 내 라이벌(볼 수 있는 사람만, 등록 순) 기록과 내 기록과의 차이. */
    public List<RivalRecordResponse> rivalRecords(Long userId, Long songDifficultyId) {
        songDifficultyRepository.findByIdAndDeletedFalse(songDifficultyId)
                .filter(d -> !d.getSong().isDeleted())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        List<User> targets = rivalRepository.findWithTargetByUserId(userId).stream()
                .map(Rival::getTarget).filter(RivalService::isVisible).toList();
        if (targets.isEmpty()) {
            return List.of();
        }
        NoteOption option = skillService.ratingNoteOption();
        List<Long> ids = new ArrayList<>(targets.stream().map(User::getId).toList());
        ids.add(userId);
        Map<Long, UserBest> bests = optionRecordRepository.findBestWithFullComboForUsers(songDifficultyId, option, ids).stream()
                .collect(Collectors.toMap(UserBest::userId, Function.identity()));
        UserBest myBest = bests.get(userId);
        BigDecimal mine = myBest == null ? null : myBest.bestRate();
        return targets.stream().map(t -> {
            UserBest best = bests.get(t.getId());
            BigDecimal rate = best == null ? null : best.bestRate();
            // 단계는 다른 화면과 같은 규칙(AchievementStage.of: 최고 달성률 + 풀콤보 여부). 기록이 없으면 null
            AchievementStage stage = best == null ? null : AchievementStage.of(best.bestRate(), best.fullCombo());
            return new RivalRecordResponse(t.getId(), t.getNickname(), rate,
                    rate == null || mine == null ? null : mine.subtract(rate), stage);
        }).toList();
    }

    // ---------- 내부 ----------

    static RivalCounts counts(Map<Long, ChartBest> mine, Map<Long, ChartBest> theirs) {
        int win = 0;
        int lose = 0;
        int tie = 0;
        int theirsOnly = 0;
        for (ChartBest t : theirs.values()) {
            switch (classify(mine.get(t.songDifficultyId()), t)) {
                case WIN -> win++;
                case LOSE -> lose++;
                case TIE -> tie++;
                case THEIRS_ONLY -> theirsOnly++;
            }
        }
        return new RivalCounts(win, lose, tie, theirsOnly);
    }

    private static Result classify(ChartBest mine, ChartBest theirs) {
        if (mine == null) {
            return Result.THEIRS_ONLY;
        }
        int cmp = mine.bestRate().compareTo(theirs.bestRate());
        return cmp > 0 ? Result.WIN : cmp < 0 ? Result.LOSE : Result.TIE;
    }

    private Map<Long, ChartBest> bestsOf(Long userId, NoteOption option) {
        Map<Long, ChartBest> map = new HashMap<>();
        optionRecordRepository.findActiveBestByUser(userId, option).forEach(b -> map.put(b.songDifficultyId(), b));
        return map;
    }

    private static Result parseResult(String value) {
        if (value == null || value.isBlank()) {
            return Result.LOSE;   // 기본: 진 곡(무엇을 더 칠지 보기 좋다)
        }
        try {
            return Result.valueOf(value.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }

    /** 비교 상대: 나 자신이 아니고 공개한 ACTIVE 유저. 아니면 404. 라이벌 대시보드 집계(RivalSummaryService)도 같은 규칙을 쓴다. */
    User findComparable(Long userId, Long targetUserId) {
        if (userId.equals(targetUserId)) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        return findPublic(targetUserId);
    }

    private User findPublic(Long targetUserId) {
        return userRepository.findByIdAndProfilePublicTrueAndStatus(targetUserId, UserStatus.ACTIVE)
                .filter(u -> u.getNickname() != null)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }

    private static boolean isVisible(User user) {
        return RivalAlertService.isVisible(user);
    }
}
