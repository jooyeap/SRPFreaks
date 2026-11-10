package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.RivalSummaryDetailResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * 라이벌 대시보드 집계(D67, 5단계). 읽기 전용이고 로그인한 사용자만 부른다.
 *
 * 상대는 "공개한 ACTIVE 유저"여야 하고 나 자신도 안 된다. 아니면(비공개·차단·없음·본인) 구분 없이 404라서
 * 존재 여부가 드러나지 않는다(RivalService.findComparable과 같은 규칙, D56·D63). 누구의 것인지는 토큰에서만 정한다.
 *
 * 흐름: 두 사람의 "레이팅 대상 채보 전체와 점수"를 각각 한 번씩 읽고(SkillService.scoredChartsAll, N+1 없음)
 * 채보 id로 맞춘 뒤 집계는 RivalSummaryCalculator(순수 계산)가 한다. 판정은 달성률 차 기준이고(D67 개정),
 * 한쪽만 기록한 곡은 승·무·패·평균에 넣지 않고 속성별 곡 수(onlyTheirs/onlyMine)로만 준다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RivalSummaryService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;

    private final RivalService rivalService;
    private final SkillService skillService;

    public RivalSummaryResponse summary(Long userId, Long targetUserId) {
        User target = rivalService.findComparable(userId, targetUserId);
        Map<Long, List<SkillService.ScoredChart>> charts = skillService.scoredChartsAll(List.of(userId, targetUserId));
        List<SkillService.ScoredChart> mine = charts.get(userId);
        List<SkillService.ScoredChart> theirs = charts.get(targetUserId);
        return RivalSummaryCalculator.summarize(target.getId(), target.getNickname(),
                RivalSummaryCalculator.share(mine, theirs), RivalSummaryCalculator.unmatched(mine, theirs),
                ratingScoreDiff(userId, targetUserId, charts));
    }

    /** 속성별 레이팅 목록 기준 점수 차(내 - 상대). 이미 읽은 채보 점수에서 계산하므로 새 쿼리가 없다. 계산을 못 구하면 빈 맵(= 응답에서 null). */
    private Map<PatternType, java.math.BigDecimal> ratingScoreDiff(Long userId, Long targetUserId,
                                                                   Map<Long, List<SkillService.ScoredChart>> charts) {
        Map<Long, Map<PatternType, java.math.BigDecimal>> lists = skillService.ratingListScoreByPattern(charts);
        if (lists == null) {
            return Map.of();
        }
        return RivalSummaryCalculator.ratingScoreDiff(lists.get(userId), lists.get(targetUserId));
    }

    /** key = 속성 키(`SINGLE` 등), filter·sort는 화이트리스트(허용 밖은 400). 페이지는 필수라 size를 1~50으로 맞춘다. */
    public RivalSummaryDetailResponse detail(Long userId, Long targetUserId, String key, String filterParam,
                                             String sortParam, int page, int size) {
        PatternType pattern = RivalSummaryCalculator.parsePattern(key);
        RivalSummaryCalculator.Filter filter = RivalSummaryCalculator.parseFilter(filterParam);
        if (pattern == null || filter == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        RivalSummaryCalculator.Sort sort = sortParam == null || sortParam.isBlank()
                ? RivalSummaryCalculator.defaultSort(filter) : RivalSummaryCalculator.parseSort(sortParam);
        if (sort == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        User target = rivalService.findComparable(userId, targetUserId);

        Map<Long, List<SkillService.ScoredChart>> charts = skillService.scoredChartsAll(List.of(userId, targetUserId));
        List<SkillService.ScoredChart> mine = charts.get(userId);
        List<SkillService.ScoredChart> theirs = charts.get(targetUserId);
        RivalSummaryCalculator.Unmatched unmatched = RivalSummaryCalculator.unmatched(mine, theirs);
        List<RivalSummaryCalculator.Shared> ofPattern = RivalSummaryCalculator
                .byPattern(RivalSummaryCalculator.share(mine, theirs)).getOrDefault(pattern, List.of());
        // 상대만 기록한 곡(속성 안). 곡별 승패의 `상대만` 탭과 같은 정의(RivalSummaryCalculator.onlyTheirsCharts)다.
        List<SkillService.ScoredChart> theirsOnly = RivalSummaryCalculator.onlyTheirsCharts(mine, theirs).stream()
                .filter(c -> c.pattern() == pattern).toList();

        List<RivalSummaryDetailResponse.Row> all;
        if (filter == RivalSummaryCalculator.Filter.THEIRS_ONLY) {
            // 상대 달성률 높은 순(onlyTheirsCharts의 순서)이 기본이고, 정렬을 TITLE로 고르면 곡명 순이다. 그 밖의 정렬 값은 이 필터에서는 쓰지 않는다.
            boolean byTitle = sort == RivalSummaryCalculator.Sort.TITLE && sortParam != null && !sortParam.isBlank();
            List<SkillService.ScoredChart> ordered = byTitle
                    ? theirsOnly.stream().sorted(Comparator
                            .comparing((SkillService.ScoredChart c) -> c.candidate().title(), String.CASE_INSENSITIVE_ORDER)
                            .thenComparing(c -> c.candidate().songDifficultyId())).toList()
                    : theirsOnly;
            all = ordered.stream().map(RivalSummaryCalculator::toTheirsOnlyRow).toList();
        } else {
            all = ofPattern.stream()
                    .filter(s -> RivalSummaryCalculator.matches(filter, s))
                    .sorted(RivalSummaryCalculator.comparator(sort))
                    .map(RivalSummaryCalculator::toRow)
                    .toList();
        }

        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        int from = (int) Math.min((long) pageIndex * pageSize, all.size());
        int to = Math.min(from + pageSize, all.size());
        int totalPages = (all.size() + pageSize - 1) / pageSize;
        List<RivalSummaryDetailResponse.Row> content = all.subList(from, to);
        return new RivalSummaryDetailResponse(target.getId(), target.getNickname(),
                RivalSummaryCalculator.patternSummary(pattern, ofPattern, unmatched, ratingScoreDiff(userId, targetUserId, charts)),
                RivalSummaryCalculator.filterCounts(ofPattern, theirsOnly.size()),
                new PageResponse<>(content, pageIndex, pageSize, all.size(), totalPages),
                RivalSummaryCalculator.tierRows(ofPattern, Stream.concat(theirsOnly.stream(),
                        RivalSummaryCalculator.onlyMineCharts(mine, theirs).stream().filter(c -> c.pattern() == pattern)).toList()));
    }

}
