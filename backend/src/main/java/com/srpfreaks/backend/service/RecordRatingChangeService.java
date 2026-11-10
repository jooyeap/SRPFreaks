package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RatingChangeResponse;
import com.srpfreaks.backend.dto.RecordResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.srpfreaks.backend.entity.PatternType;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

/**
 * 기록을 저장할 때 레이팅이 어떻게 바뀌는지 같이 돌려준다 (저장 직후 안내용).
 * 저장 전후 레이팅을 각각 계산해(SkillService.mySkill, 내 레이팅 화면과 같은 값) 비교한다.
 * 저장은 자기 트랜잭션으로 끝난 뒤(save가 커밋한 뒤)에 "이후" 값을 계산하므로 방금 저장한 기록이 반드시 반영된다.
 * 레이팅 계산이 실패해도 저장은 이미 끝났으므로 저장 응답을 실패시키지 않고 변화 정보만 비운다.
 * 이 클래스는 트랜잭션을 열지 않는다(저장 트랜잭션 안에서 계산하면 아직 커밋되지 않은 값을 읽을 수 있어서).
 */
@Service
@RequiredArgsConstructor
public class RecordRatingChangeService {

    private static final Logger log = LoggerFactory.getLogger(RecordRatingChangeService.class);

    private final SkillService skillService;

    /**
     * save를 실행하고, 그 전후의 레이팅 변화를 붙인 응답을 돌려준다.
     * chartId = 저장하는 채보. 저장 "전"의 이 채보 최고 기록(이전 최고)을 알아야 해서 저장 전에 받는다(null이면 상세 필드만 비운다).
     * mySkill은 전/후 2번뿐이고, 이 채보 한 개의 상태(chartRating)만 전/후로 더 읽는다(후보 전체를 다시 계산하지 않는다).
     */
    public RecordResponse withChange(Long userId, Long chartId, Supplier<RecordResponse> save) {
        SkillResponse before = safeSkill(userId);
        ChartRating chartBefore = safeChart(userId, chartId);
        RecordResponse saved = save.get();
        SkillResponse after = safeSkill(userId);
        ChartRating chartAfter = safeChart(userId, chartId);
        if (before == null || after == null) {
            return saved;
        }
        RatingChangeResponse base = change(before, after, saved.songDifficultyId());
        return saved.withRatingChange(detail(base, after, saved, chartBefore, chartAfter));
    }

    static RatingChangeResponse change(SkillResponse before, SkillResponse after, Long chartId) {
        boolean wasInList = contains(before, chartId);
        boolean inList = contains(after, chartId);
        return new RatingChangeResponse(before.totalScore(), after.totalScore(),
                after.totalScore().subtract(before.totalScore()), !wasInList && inList, inList);
    }

    /**
     * 기본 값(base)에 카드용 상세 필드를 붙인다. 저장 뒤 상태(chartAfter)를 모르면 기본 값 그대로 돌려준다.
     * 점수는 ChartRating이 RatingCalculator로 이미 계산한 표시값이고, 여기서는 순위·남은 점수만 목록에서 읽는다.
     * pointsToList = 그룹이 가득 찼을 때 마지막 항목 점수 - 내 점수 (둘 다 표시값이라 화면 숫자와 어긋나지 않는다).
     */
    private static RatingChangeResponse detail(RatingChangeResponse base, SkillResponse after, RecordResponse saved,
                                               ChartRating chartBefore, ChartRating chartAfter) {
        if (chartAfter == null) {
            return base;
        }
        PatternType.RatingGroup group = chartAfter.group();
        Integer limit = null;
        Integer rank = null;
        BigDecimal pointsToList = null;
        if (group != null) {
            boolean single = group == PatternType.RatingGroup.SINGLE;
            List<SkillEntryResponse> list = single ? after.single() : after.other();
            limit = single ? after.singleLimit() : after.otherLimit();
            for (SkillEntryResponse e : list) {
                if (e.songDifficultyId().equals(saved.songDifficultyId())) {
                    rank = e.rank();
                }
            }
            if (rank == null && chartAfter.score() != null && !list.isEmpty() && list.size() >= limit) {
                BigDecimal gap = list.get(list.size() - 1).score().subtract(chartAfter.score());
                pointsToList = gap.signum() > 0 ? gap : null;   // 동점으로 밀렸으면(0) 남은 점수를 말할 수 없다
            }
        }
        BigDecimal previous = chartBefore == null ? null : chartBefore.bestRate();
        Boolean newBest = null;
        Boolean loweredBest = null;
        if (chartBefore != null && saved.achievementRate() != null) {
            newBest = previous == null || saved.achievementRate().compareTo(previous) > 0;
            loweredBest = previous != null && chartAfter.bestRate() != null
                    && chartAfter.bestRate().compareTo(previous) < 0;
        }
        return new RatingChangeResponse(base.totalBefore(), base.totalAfter(), base.change(), base.entered(),
                base.inList(), chartAfter.notRatedReason(), group, rank, limit,
                chartBefore == null ? null : chartBefore.score(), chartAfter.score(), pointsToList,
                newBest, previous, loweredBest);
    }

    private static boolean contains(SkillResponse skill, Long chartId) {
        Set<Long> ids = new HashSet<>();
        for (SkillEntryResponse e : skill.single()) ids.add(e.songDifficultyId());
        for (SkillEntryResponse e : skill.other()) ids.add(e.songDifficultyId());
        return ids.contains(chartId);
    }

    private ChartRating safeChart(Long userId, Long chartId) {
        if (chartId == null) {
            return null;
        }
        try {
            return skillService.chartRating(userId, chartId);
        } catch (RuntimeException e) {
            log.warn("채보 레이팅 상태를 계산하지 못했습니다(저장은 정상 처리됨): {}", e.getClass().getSimpleName());
            return null;
        }
    }

    private SkillResponse safeSkill(Long userId) {
        try {
            return skillService.mySkill(userId);
        } catch (RuntimeException e) {
            log.warn("레이팅 변화를 계산하지 못했습니다(저장은 정상 처리됨): {}", e.getClass().getSimpleName());
            return null;
        }
    }
}
