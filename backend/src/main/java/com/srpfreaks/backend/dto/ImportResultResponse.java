package com.srpfreaks.backend.dto;

import java.util.List;
import java.util.Map;

/**
 * 가져오기 결과. 저장·건너뜀 개수, 사유별 개수, 건별 결과, 그리고 곡 목록(마스터)에 없어 제외한 곡명을 돌려준다.
 * 제외한 곡은 화면에 "곡 목록에 없어 제외했습니다"로 그대로 안내한다.
 */
public record ImportResultResponse(
        int saved,
        int skipped,
        Map<ImportSkipReason, Integer> skippedByReason,
        List<ImportPlayResult> results,
        List<String> excludedSongs) {
}
