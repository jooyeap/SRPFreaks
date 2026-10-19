package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SetlistRecommendationResponse;
import com.srpfreaks.backend.dto.SetlistRecommendationResponse.Item;
import com.srpfreaks.backend.dto.TableEntryResponse.MyRecord;
import com.srpfreaks.backend.entity.AchievementStage;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.mapper.RecommendCandidate;
import com.srpfreaks.backend.mapper.SetlistRecommendMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 세트리스트 추천(D37). 내 평균 난이도(PlayLevelEstimator)를 기준으로 오늘 도전해 볼 채보를 두 묶음으로 골라 준다.
 *
 * - SS 도전: 평균 ± setlist.recommend_range_ss 안, 기록이 없거나 SS 미만(FC·EXC는 SS 이상으로 본다 - 달성 단계 규칙, D24).
 * - S 채우기: 평균 ± setlist.recommend_range_s(더 넓다) 안, 기록이 없거나 S 미만이고 SS 도전에 들어가지 않은 것.
 * - 이미 세트리스트에 담은 채보와 레이팅 대상이 아닌 채보(미정·레이팅 제외·반영 꺼짐)는 쿼리에서 빠진다.
 * - 정렬: 평균 난이도에 가까운 순이 먼저(내 실력대에 가장 맞는 곡이 위), 같으면 기록 없는 채보, 내 최고 달성률이 낮은 순, 채보 id 순(요청마다 순서가 바뀌지 않게).
 * - 두 묶음을 같은 page로 size개씩 넘긴다. 조회는 넓은 범위 한 번이고 단계 판정·정렬·페이지는 여기(Java)에서 한다.
 * userId는 토큰에서만 오고, 남의 기록은 쿼리에서 user_id 조건으로 섞이지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SetlistRecommendService {

    public static final int DEFAULT_PAGE_SIZE = 5;
    public static final int MAX_PAGE_SIZE = 10;

    /** 추천이 기준으로 삼는 기록·서열표의 노트 옵션. 기록은 SRN+ 하나만 받는다(D25). */
    static final NoteOption RECORD_OPTION = NoteOption.SUPER_RANDOM_PLUS;

    private final AppSettingRepository appSettingRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final SetlistRecommendMapper recommendMapper;
    private final PlayLevelEstimator playLevelEstimator;

    /** 잘못된 page/size는 400이 아니라 허용 범위로 맞춘다(목록 API 공통 방식). */
    public SetlistRecommendationResponse recommend(Long userId, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        SetlistRecommendConfig config = SetlistRecommendConfig.from(appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue)));

        Optional<DifficultyTable> table = difficultyTableRepository
                .findFirstByNoteOptionAndStatusOrderByIdAsc(RECORD_OPTION, TableStatus.ACTIVE);
        Optional<BigDecimal> base = table.isEmpty() ? Optional.empty() : playLevelEstimator.estimate(userId);
        if (base.isEmpty()) {
            return SetlistRecommendationResponse.unavailable(config.rangeSs(), config.rangeS(), pageIndex, pageSize);
        }

        BigDecimal baseTier = base.get();
        List<RecommendCandidate> candidates = recommendMapper.findCandidates(userId, RECORD_OPTION.name(),
                table.get().getId(), PatternType.EXCLUDED.getLabel(),
                baseTier.subtract(config.rangeS()), baseTier.add(config.rangeS()));

        Comparator<RecommendCandidate> order = order(baseTier);
        List<RecommendCandidate> ss = candidates.stream()
                .filter(c -> within(c, baseTier, config.rangeSs()) && below(c, AchievementStage.SS))
                .sorted(order).toList();
        List<RecommendCandidate> s = candidates.stream()
                .filter(c -> !ss.contains(c) && within(c, baseTier, config.rangeS()) && below(c, AchievementStage.S))
                .sorted(order).toList();

        int totalPages = Math.max(pages(ss.size(), pageSize), pages(s.size(), pageSize));
        return new SetlistRecommendationResponse(baseTier, config.rangeSs(), config.rangeS(),
                slice(ss, pageIndex, pageSize), slice(s, pageIndex, pageSize), pageIndex, pageSize, totalPages);
    }

    /** 기준 난이도가 baseTier ± range 안(경계 포함)인가. */
    private static boolean within(RecommendCandidate c, BigDecimal baseTier, BigDecimal range) {
        return c.tier().subtract(baseTier).abs().compareTo(range) <= 0;
    }

    /** 기록이 없거나, 기록의 달성 단계가 limit보다 낮은가. (SS 미만 = S 이하, FC·EXC는 SS 이상이다) */
    private static boolean below(RecommendCandidate c, AchievementStage limit) {
        AchievementStage stage = stageOf(c);
        return stage == null || stage.compareTo(limit) < 0;
    }

    private static AchievementStage stageOf(RecommendCandidate c) {
        return c.bestRate() == null ? null : AchievementStage.of(c.bestRate(), Boolean.TRUE.equals(c.fullCombo()));
    }

    private static Comparator<RecommendCandidate> order(BigDecimal baseTier) {
        // 가까운 순이 첫 기준이다. 예전에는 기록 없음이 먼저여서 평균에서 먼 곡이 맨 위에 올 수 있었다.
        return Comparator
                .comparing((RecommendCandidate c) -> c.tier().subtract(baseTier).abs())
                .thenComparing(c -> c.bestRate() != null)                       // false(기록 없음)가 먼저
                .thenComparing(c -> c.bestRate() == null ? BigDecimal.ZERO : c.bestRate())
                .thenComparing(RecommendCandidate::songDifficultyId);
    }

    private static int pages(int count, int size) {
        return (count + size - 1) / size;
    }

    private static List<Item> slice(List<RecommendCandidate> all, int page, int size) {
        int from = (int) Math.min((long) page * size, all.size());
        int to = Math.min(from + size, all.size());
        return all.subList(from, to).stream().map(SetlistRecommendService::toItem).toList();
    }

    private static Item toItem(RecommendCandidate c) {
        AchievementStage stage = stageOf(c);
        MyRecord mine = stage == null ? null : new MyRecord(c.bestRate(), Boolean.TRUE.equals(c.fullCombo()), stage);
        return new Item(c.songDifficultyId(), c.songId(), c.title(), InstrumentPart.valueOf(c.part()),
                DifficultyType.valueOf(c.difficulty()), c.level(), c.tier(), mine);
    }
}
