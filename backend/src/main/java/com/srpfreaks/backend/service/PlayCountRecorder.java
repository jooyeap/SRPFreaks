package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.PlayCountCursor;
import com.srpfreaks.backend.repository.ChartPlayCountRepository;
import com.srpfreaks.backend.repository.PlayCountCursorRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * 플레이 횟수 집계 (D84). 서열표 분석에서 "이 채보를 몇 번 쳤나"를 보려고 (사용자, 채보)별 횟수와 마지막 플레이 시각만 센다.
 *
 * 세는 규칙
 *  - 가져오기 저장(ImportService 저장 경로만, 미리보기는 부르지 않는다): 채보에 연결된 **모든 유효한 플레이**를 센다.
 *    최고 기록보다 낮거나 개선이 없어 option_records에 저장하지 않은 플레이도 "친 횟수"이므로 센다.
 *    곡을 못 찾았거나 옵션·값이 걸러진 줄은 채보에 연결되지 않아 호출되지 않는다.
 *  - 중복 방지: 사용자별 커서(마지막으로 센 플레이 시각)보다 **엄격히 늦은** 플레이만 센다. 같은 최근 플레이를 다시 가져와도 두 번 세지 않는다.
 *    끝나면 커서를 이번에 센 플레이의 최대 시각으로 **앞으로만** 옮긴다. 커서가 비어 있으면 요청의 전부를 센다.
 *  - 한 요청 안에서 같은 채보·같은 시각(밀리초)의 줄은 같은 플레이를 두 번 보낸 것으로 보고 한 번만 센다.
 *  - 직접 입력·사진 입력(둘 다 POST /records → OptionRecordService.create): 저장이 성공할 때마다 그 채보 +1. 수정은 세지 않는다.
 *    직접 입력은 커서를 건드리지 않는다.
 *
 * 실패 처리: 집계는 부가 기능이라 **실패해도 기록 저장·가져오기는 성공해야 한다**(D52 세트리스트 이력과 같은 원칙).
 *  - 기록 저장 트랜잭션이 **커밋된 뒤에** 집계한다(afterCommit). 그래서 저장이 롤백되면 횟수도 남지 않는다.
 *  - 집계는 자기 트랜잭션(REQUIRES_NEW)에서 하고 예외를 여기서 삼킨다. 같은 트랜잭션에서 실패를 catch만 하면 저장소 호출이
 *    트랜잭션을 "롤백만 가능"으로 표시해 바깥 저장까지 취소될 수 있어서, 트랜잭션을 분리한다. 커서와 횟수는 한 트랜잭션이라 함께 반영되거나 함께 취소된다.
 *  - 로그에는 사용자·채보 id를 남기지 않는다(예외 종류만).
 */
@Slf4j
@Component
public class PlayCountRecorder {

    /** 채보에 연결된 플레이 한 건. 같은 (채보, 시각)은 equals가 같아 집합에서 한 번만 남는다. */
    public record PlayedChart(Long chartId, Instant playedAt) {
    }

    private final ChartPlayCountRepository countRepository;
    private final PlayCountCursorRepository cursorRepository;
    private final TransactionTemplate newTransaction;
    private final Clock clock;

    public PlayCountRecorder(ChartPlayCountRepository countRepository, PlayCountCursorRepository cursorRepository,
                             PlatformTransactionManager transactionManager, Clock clock) {
        this.countRepository = countRepository;
        this.cursorRepository = cursorRepository;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.clock = clock;
    }

    /** 가져오기 저장 경로에서 부른다. 호출한 트랜잭션이 커밋된 뒤에 센다(트랜잭션이 없으면 바로). 절대 예외를 던지지 않는다. */
    public void recordImported(Long userId, Collection<PlayedChart> plays) {
        if (plays == null || plays.isEmpty()) {
            return;
        }
        Set<PlayedChart> snapshot = new LinkedHashSet<>(plays); // 호출한 쪽이 목록을 바꿔도 영향받지 않게 복사 + 같은 (채보, 시각) 합치기
        runAfterCommit(() -> countImported(userId, snapshot));
    }

    /** 기록 한 건을 새로 만들었을 때(직접·사진) 그 채보를 +1 한다. 시각이 없으면 지금. 커서는 건드리지 않는다. */
    public void recordCreated(Long userId, Long chartId, Instant playedAt) {
        Instant at = playedAt != null ? playedAt : clock.instant();
        runAfterCommit(() -> countCreated(userId, chartId, at));
    }

    private void runAfterCommit(Runnable work) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    safely(work);
                }
            });
        } else {
            safely(work);
        }
    }

    private void safely(Runnable work) {
        try {
            work.run();
        } catch (RuntimeException e) {
            log.warn("플레이 횟수 집계 실패: {}", e.getClass().getSimpleName());
        }
    }

    private void countCreated(Long userId, Long chartId, Instant playedAt) {
        newTransaction.executeWithoutResult(status -> countRepository.addPlays(userId, chartId, 1, playedAt));
    }

    private void countImported(Long userId, Set<PlayedChart> plays) {
        newTransaction.executeWithoutResult(status -> {
            cursorRepository.ensureExists(userId);
            // 같은 사용자의 다른 가져오기가 동시에 커서를 읽지 못하게 잠그고 읽는다(두 번 세기 방지)
            PlayCountCursor cursor = cursorRepository.findForUpdate(userId).orElseThrow();
            Instant after = cursor.getLastCountedAt();

            Map<Long, Integer> counts = new LinkedHashMap<>();
            Map<Long, Instant> latest = new LinkedHashMap<>();
            Instant maxPlayedAt = null;
            for (PlayedChart p : plays) {
                if (after != null && !p.playedAt().isAfter(after)) {
                    continue; // 이미 센 시각 이전(같은 시각 포함)의 플레이
                }
                counts.merge(p.chartId(), 1, Integer::sum);
                latest.merge(p.chartId(), p.playedAt(), (a, b) -> a.isAfter(b) ? a : b);
                if (maxPlayedAt == null || p.playedAt().isAfter(maxPlayedAt)) {
                    maxPlayedAt = p.playedAt();
                }
            }
            if (counts.isEmpty()) {
                return;
            }
            counts.forEach((chartId, delta) -> countRepository.addPlays(userId, chartId, delta, latest.get(chartId)));
            cursor.advanceTo(maxPlayedAt);
        });
    }
}
