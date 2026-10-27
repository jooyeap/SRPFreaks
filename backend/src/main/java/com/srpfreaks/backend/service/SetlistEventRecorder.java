package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.SetlistEventType;
import com.srpfreaks.backend.repository.SetlistEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 세트리스트 담기/빼기를 이력으로 남긴다 (D52). 추천 집계용 수집이라 **실패해도 담기/빼기는 성공해야 한다.**
 *  - 하루 한 줄: 같은 (사용자, 채보, 종류, 서울 날짜)는 DB가 한 줄로 합친다(SetlistEventRepository.insertIfAbsent).
 *  - 평균 난이도: PlayLevelEstimator가 READY일 때만 남기고 아니면 null. 계산이 실패해도 null로 저장한다.
 *  - 로그에는 사용자·채보 id를 남기지 않는다(예외 종류만).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SetlistEventRecorder {

    /** "하루"의 기준. 스냅샷(D32)과 같이 사용자가 보는 서울 날짜로 센다. */
    static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    private final SetlistEventRepository eventRepository;
    private final PlayLevelEstimator playLevelEstimator;
    private final Clock clock;

    /**
     * REQUIRES_NEW: 세트리스트 담기/빼기 트랜잭션과 따로 커밋한다. 이력 저장이 예상 밖으로 실패해도 예외를 잡아 삼키는 것만으로는
     * 같은 트랜잭션이 "롤백만 가능" 상태로 표시될 수 있어, 담기/빼기까지 취소되는 것을 이 분리로 막는다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long userId, Long songDifficultyId, SetlistEventType type) {
        try {
            eventRepository.insertIfAbsent(userId, songDifficultyId, type.name(), LocalDate.ofInstant(clock.instant(), ZONE),
                    averageLevelOf(userId));
        } catch (RuntimeException e) {
            log.warn("세트리스트 이력 저장 실패: {}", e.getClass().getSimpleName());
        }
    }

    private BigDecimal averageLevelOf(Long userId) {
        try {
            PlayLevelEstimate estimate = playLevelEstimator.estimate(userId);
            return estimate.status() == PlayLevelEstimate.Status.READY ? estimate.tier() : null;
        } catch (RuntimeException e) {
            log.warn("세트리스트 이력의 평균 난이도 계산 실패: {}", e.getClass().getSimpleName());
            return null;
        }
    }
}
