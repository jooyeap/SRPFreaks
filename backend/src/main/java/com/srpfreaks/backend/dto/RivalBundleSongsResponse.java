package com.srpfreaks.backend.dto;

import java.util.List;

/**
 * 라이벌 묶음 알림 상세(D86). songs = 곡 목록의 한 쪽, actorUserId·actorNickname = 화면의 "비교 보기" 링크용.
 * songCount = 묶음이 처음 센 곡 수, missingCount = 목록이 남아 있지 않은 곡 수(예전 묶음은 묶일 때 줄을 지웠다).
 * 삭제된 곡·채보는 songs에서 빠지지만 missingCount에는 들어가지 않는다(줄은 남아 있기 때문).
 */
public record RivalBundleSongsResponse(Long actorUserId, String actorNickname, int songCount, int missingCount,
                                       PageResponse<RivalBundleSongResponse> songs) {
}
