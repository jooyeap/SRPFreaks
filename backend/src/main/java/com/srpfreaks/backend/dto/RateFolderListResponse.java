package com.srpfreaks.backend.dto;

import java.util.List;

/** 폴더 목록. 레벨 폴더는 레벨이 높은 폴더가 위, 서열표 난이도는 기준 난이도가 높은 묶음이 위다. */
public record RateFolderListResponse(List<RateFolderResponse> folders) {
}
