package com.srpfreaks.backend.dto;

import java.util.List;
import java.util.Map;

/**
 * 곡 목록 첫 화면: 전체 곡 수 / 채보 수(머리글 `465곡 · 669개`), 버전 필터에 쓸 버전 목록, 레벨 높은 폴더부터의 폴더 목록.
 * 채보가 하나도 없는 레벨 폴더는 포함하지 않는다.
 * patternCounts: 홈 진행도 카드의 속성 칩(`단일 n`)에 쓰는 속성별 채보 수(키는 단일/복합/이중/삼중). 속성 필터(pattern)를 걸어도
 * 그 필터를 걸기 전 기준이라 칩 숫자가 흔들리지 않는다. 서열표에 없거나 속성이 없는 채보는 어느 키에도 세지 않는다(전체에만 들어간다).
 */
public record ChartFolderListResponse(int totalSongs, int totalCharts, List<String> versions,
                                      List<ChartFolderResponse> folders, Map<String, Integer> patternCounts) {
}
