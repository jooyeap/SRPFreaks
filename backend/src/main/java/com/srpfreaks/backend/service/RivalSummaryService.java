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

import java.util.List;
import java.util.Map;

/**
 * 라이벌 대시보드 집계(D67, 5단계). 읽기 전용이고 로그인한 사용자만 부른다.
 *
 * 상대는 "공개한 ACTIVE 유저"여야 하고 나 자신도 안 된다. 아니면(비공개·차단·없음·본인) 구분 없이 404라서
 * 존재 여부가 드러나지 않는다(RivalService.findComparable과 같은 규칙, D56·D63). 누구의 것인지는 토큰에서만 정한다.
 *
 * 흐름: 두 사람의 "레이팅 대상 채보 전체와 점수"를 각각 한 번씩 읽고(SkillService.scoredChartsAll, N+1 없음)
 * 채보 id로 맞춘 뒤 집계는 RivalSummaryCalculator(순수 계산)가 한다.
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
        return RivalSummaryCalculator.summarize(target.getId(), target.getNickname(), shared(userId, targetUserId));
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

        List<RivalSummaryCalculator.Shared> ofPattern = RivalSummaryCalculator
                .byPattern(shared(userId, targetUserId)).getOrDefault(pattern, List.of());
        List<RivalSummaryCalculator.Shared> filtered = ofPattern.stream()
                .filter(s -> RivalSummaryCalculator.matches(filter, s))
                .sorted(RivalSummaryCalculator.comparator(sort))
                .toList();

        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        int from = (int) Math.min((long) pageIndex * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());
        int totalPages = (filtered.size() + pageSize - 1) / pageSize;
        List<RivalSummaryDetailResponse.Row> content = filtered.subList(from, to).stream()
                .map(RivalSummaryCalculator::toRow).toList();
        return new RivalSummaryDetailResponse(target.getId(), target.getNickname(),
                RivalSummaryCalculator.patternSummary(pattern, ofPattern), RivalSummaryCalculator.filterCounts(ofPattern),
                new PageResponse<>(content, pageIndex, pageSize, filtered.size(), totalPages));
    }

    private List<RivalSummaryCalculator.Shared> shared(Long userId, Long targetUserId) {
        Map<Long, List<SkillService.ScoredChart>> charts = skillService.scoredChartsAll(List.of(userId, targetUserId));
        return RivalSummaryCalculator.share(charts.get(userId), charts.get(targetUserId));
    }
}
