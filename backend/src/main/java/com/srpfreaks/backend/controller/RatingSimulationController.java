package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.RatingSimulationResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.RatingSimulationService;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * 곡 상세의 컷라인 · 목표 달성률 · 시뮬레이션 (D71). 읽기 전용이고 아무것도 저장하지 않는다.
 * 쿼리: songDifficultyId(채보, 필수), achievement(0.00~100.00, 선택. 없으면 컷라인만).
 * 달성률 검사는 기록 입력(RecordRequest)과 같은 규칙이다(0.00~100.00, 소수 둘째 자리까지).
 * 쿼리 값을 @RequestParam으로 받는 이유: 숫자가 아닌 값(abc)이 오면 스프링이 "변환 실패" 상세 메시지(클래스 이름 포함)를 만드는데,
 * @RequestParam 변환 실패는 공통 에러 처리가 상세 없이 400으로만 내려주기 때문이다(요청 객체로 묶으면 그 메시지가 fieldErrors에 실린다).
 * 사용자 id는 받지 않고 토큰의 본인 기준으로만 계산한다(경로가 /me). 인증이 필요한 경로이고 공개 경로 목록에 넣지 않는다.
 * 기존 SkillController(내 레이팅)와 같은 /api/v1/skills 아래에 두되, 시뮬레이션은 따로 둬서 그쪽 구성을 건드리지 않았다.
 */
@RestController
@RequestMapping("/api/v1/skills/me")
@RequiredArgsConstructor
public class RatingSimulationController {

    private final RatingSimulationService simulationService;

    @GetMapping("/simulate")
    public RatingSimulationResponse simulate(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam Long songDifficultyId,
            @RequestParam(required = false)
            @DecimalMin(value = "0.00", message = "달성률은 0.00 이상이어야 합니다.")
            @DecimalMax(value = "100.00", message = "달성률은 100.00 이하여야 합니다.")
            @Digits(integer = 3, fraction = 2, message = "달성률은 소수 둘째 자리까지만 입력할 수 있습니다.") BigDecimal achievement) {
        return simulationService.simulate(user.id(), songDifficultyId, achievement);
    }
}
