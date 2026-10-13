package com.srpfreaks.backend.dto;

import java.util.List;

/**
 * 곡 목록 첫 화면: 전체 곡 수 / 채보 수(머리글 `465곡 · 669개`), 버전 필터에 쓸 버전 목록, 레벨 높은 폴더부터의 폴더 목록.
 * 채보가 하나도 없는 레벨 폴더는 포함하지 않는다.
 */
public record ChartFolderListResponse(int totalSongs, int totalCharts, List<String> versions,
                                      List<ChartFolderResponse> folders) {
}
