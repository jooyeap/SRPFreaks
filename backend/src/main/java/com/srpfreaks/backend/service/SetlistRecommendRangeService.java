package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SetlistRecommendRangeRequest;
import com.srpfreaks.backend.dto.SetlistRecommendRangeResponse;
import com.srpfreaks.backend.entity.SetlistRecommendRange;
import com.srpfreaks.backend.repository.SetlistRecommendRangeRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * 사용자별 세트리스트 추천 범위 저장·초기화 (D37). userId는 토큰에서만 오고 요청 본문에는 사용자 id가 없다.
 * 항목별 형식(-3.00~3.00, 소수 둘째 자리)은 요청 DTO의 Validation이 막고, 여기서는 항목 사이의 규칙(하한 <= 상한)과
 * 형식을 한 번 더 확인한다(서비스를 직접 부르는 코드도 같은 규칙을 지키게). DB CHECK가 마지막 방어선이다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SetlistRecommendRangeService {

    static final BigDecimal LIMIT = new BigDecimal("3.00");

    private final SetlistRecommendRangeRepository rangeRepository;
    private final UserRepository userRepository;

    /** 있으면 고치고 없으면 만든다(사용자당 한 줄). */
    public SetlistRecommendRangeResponse save(Long userId, SetlistRecommendRangeRequest request) {
        validate(request);
        SetlistRecommendRange range = rangeRepository.findByUserId(userId).orElse(null);
        if (range == null) {
            range = SetlistRecommendRange.create(userRepository.getReferenceById(userId),
                    request.ssMin(), request.ssMax(), request.sMin(), request.sMax());
        } else {
            range.change(request.ssMin(), request.ssMax(), request.sMin(), request.sMax());
        }
        SetlistRecommendRange saved = rangeRepository.save(range);
        return new SetlistRecommendRangeResponse(saved.getSsMin(), saved.getSsMax(), saved.getSMin(), saved.getSMax());
    }

    /** 기본값으로 되돌린다. 설정이 없어도 오류가 아니다. */
    public void reset(Long userId) {
        rangeRepository.deleteByUserId(userId);
    }

    private static void validate(SetlistRecommendRangeRequest r) {
        if (r.ssMin().compareTo(r.ssMax()) > 0 || r.sMin().compareTo(r.sMax()) > 0) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        for (BigDecimal v : new BigDecimal[]{r.ssMin(), r.ssMax(), r.sMin(), r.sMax()}) {
            if (v.abs().compareTo(LIMIT) > 0 || v.stripTrailingZeros().scale() > 2) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR);
            }
        }
    }
}
