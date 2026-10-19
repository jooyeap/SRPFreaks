package com.srpfreaks.backend.dto;

import java.math.BigDecimal;

/**
 * 보낸 플레이 한 건의 처리 결과. index는 요청의 plays 순서(0부터)이고, 저장했으면 reason은 null이다.
 * 미리보기에서는 saved가 "저장하게 될 것"을 뜻한다. previousBestRate는 이 채보의 내 기존 최고 달성률(SRN+)이고
 * 곡을 찾았을 때만 채운다(기록이 없으면 null). 화면이 `91.20 → 96.50`처럼 보여 주는 데 쓴다.
 */
public record ImportPlayResult(int index, String title, boolean saved, ImportSkipReason reason, BigDecimal previousBestRate) {

    /** 이전 최고 기록 없이 만드는 기본 생성자(곡을 못 찾았거나 걸러진 경우). */
    public ImportPlayResult(int index, String title, boolean saved, ImportSkipReason reason) {
        this(index, title, saved, reason, null);
    }
}
