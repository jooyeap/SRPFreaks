package com.srpfreaks.backend.service;

import com.srpfreaks.backend.entity.NoteOption;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * 기록 저장 쪽(직접 입력·수정·가져오기)에서 부르는 입구(D56). 알림 판정이 어떤 이유로 실패해도 기록 저장은 성공해야 하므로
 * 여기서 예외를 모두 삼킨다. RivalAlertService.detect는 REQUIRES_NEW라서, 그 트랜잭션이 롤백돼 커밋 시점에 나는 예외도
 * 이 바깥에서 잡힌다(같은 클래스 안에서 부르면 프록시를 거치지 않아 REQUIRES_NEW가 적용되지 않으므로 클래스를 나눴다).
 * 로그에는 사용자·채보 id를 남기지 않는다(예외 종류만).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RivalAlertTrigger {

    private final RivalAlertService rivalAlertService;

    public void recordSaved(Long userId, Long songDifficultyId, NoteOption noteOption, BigDecimal prev, BigDecimal next) {
        if (prev == null || next == null || next.compareTo(prev) <= 0) {
            return;   // 첫 기록·최고 기록이 오르지 않은 저장은 트랜잭션을 열 필요도 없다
        }
        try {
            rivalAlertService.detect(userId, songDifficultyId, noteOption, prev, next);
        } catch (RuntimeException e) {
            log.warn("라이벌 알림 판정 실패: {}", e.getClass().getSimpleName());
        }
    }
}
