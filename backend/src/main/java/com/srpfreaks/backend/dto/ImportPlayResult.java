package com.srpfreaks.backend.dto;

/** 보낸 플레이 한 건의 처리 결과. index는 요청의 plays 순서(0부터)이고, 저장했으면 reason은 null이다. */
public record ImportPlayResult(int index, String title, boolean saved, ImportSkipReason reason) {
}
