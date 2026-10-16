package com.srpfreaks.backend.repository;

import java.time.Instant;

/** 한 채보에 대한 내 기록의 가장 최근 저장·수정 시각. 세트리스트 완료 판정에 쓴다. */
public record RecordLatestUpdate(Long songDifficultyId, Instant latestUpdate) {
}
