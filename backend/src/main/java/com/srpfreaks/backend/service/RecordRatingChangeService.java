package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.RatingChangeResponse;
import com.srpfreaks.backend.dto.RecordResponse;
import com.srpfreaks.backend.dto.SkillEntryResponse;
import com.srpfreaks.backend.dto.SkillResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashSet;
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

    /** save를 실행하고, 그 전후의 레이팅 변화를 붙인 응답을 돌려준다. */
    public RecordResponse withChange(Long userId, Supplier<RecordResponse> save) {
        SkillResponse before = safeSkill(userId);
        RecordResponse saved = save.get();
        SkillResponse after = safeSkill(userId);
        if (before == null || after == null) {
            return saved;
        }
        return saved.withRatingChange(change(before, after, saved.songDifficultyId()));
    }

    static RatingChangeResponse change(SkillResponse before, SkillResponse after, Long chartId) {
        boolean wasInList = contains(before, chartId);
        boolean inList = contains(after, chartId);
        return new RatingChangeResponse(before.totalScore(), after.totalScore(),
                after.totalScore().subtract(before.totalScore()), !wasInList && inList, inList);
    }

    private static boolean contains(SkillResponse skill, Long chartId) {
        Set<Long> ids = new HashSet<>();
        for (SkillEntryResponse e : skill.single()) ids.add(e.songDifficultyId());
        for (SkillEntryResponse e : skill.other()) ids.add(e.songDifficultyId());
        return ids.contains(chartId);
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
