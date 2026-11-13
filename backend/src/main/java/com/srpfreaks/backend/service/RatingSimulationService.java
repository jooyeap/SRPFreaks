package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.NotRatedReason;
import com.srpfreaks.backend.dto.RatingSimulationResponse;
import com.srpfreaks.backend.dto.RatingSimulationResponse.Status;
import com.srpfreaks.backend.entity.LabeledEnum;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.PatternType.RatingGroup;
import com.srpfreaks.backend.mapper.ChartRatingRow;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.service.SkillService.ScoredChart;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * 곡 상세의 컷라인 · 목표 달성률 · 시뮬레이션 (D71). 읽기 전용이고 아무것도 저장하지 않는다.
 *
 * 흐름: 채보가 있는지 확인(없거나 삭제됐으면 404) -> 이 채보의 서열표 값 + 내 최고 달성률 한 줄 -> 레이팅 대상인지 판정
 *       -> (대상이면) 내 레이팅 대상 채보 전체를 SkillService와 같은 코드로 계산 -> RatingSimulator가 컷라인·시뮬레이션 계산.
 *
 * 보안: userId는 컨트롤러가 토큰에서만 넘긴다. 채보(곡 마스터)는 공개 정보라 누구나 볼 수 있지만,
 * 계산에 쓰는 기록은 전부 이 userId의 것뿐이다(다른 사용자의 기록을 읽는 경로가 없다).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RatingSimulationService {

    private final SongDifficultyRepository songDifficultyRepository;
    private final SkillService skillService;

    public RatingSimulationResponse simulate(Long userId, Long chartId, BigDecimal achievement) {
        songDifficultyRepository.findByIdAndDeletedFalse(chartId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        RatingConfig config = skillService.ratingConfig();
        ChartRatingRow row = skillService.chartRatingRow(userId, chartId, config);
        NotRatedReason reason = row == null ? NotRatedReason.NOT_RATED : SkillService.notRatedReason(row);
        if (reason != null) {
            // 레이팅 대상이 아니면 그룹도 컷라인도 없다. 화면은 카드를 숨기고 이유만 안내한다.
            return new RatingSimulationResponse(Status.NOT_RATED, reason, null, 0, 0, null, null, null, null, null);
        }

        RatingGroup group = PatternType.ratingGroupOf(LabeledEnum.fromLabel(PatternType.class, row.pattern()));
        List<ScoredChart> rated = skillService.scoredChartsAll(List.of(userId)).get(userId);
        RatingSimulator simulator = new RatingSimulator(config, new RatingCalculator(config));
        return simulator.simulate(rated, new RatingSimulator.Target(chartId, row.tier(), group, row.bestRate()), achievement);
    }
}
