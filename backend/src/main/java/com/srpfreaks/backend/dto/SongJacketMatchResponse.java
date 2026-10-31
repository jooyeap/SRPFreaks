package com.srpfreaks.backend.dto;

import java.util.List;

/**
 * 재킷 가져오기(D54) 곡명 매칭 결과. 브라우저는 matches의 곡만 재킷을 받아 줄인다.
 *
 * @param matches          마스터와 곡명이 하나로 맞은 곡 (hasJacket이면 교체 후보)
 * @param unmatchedCount   공식 곡 중 마스터에 없거나 같은 이름이 둘 이상이라 뺀 곡 수
 * @param missingSongs     마스터 곡 중 공식 목록에서 찾지 못한 곡 (관리자가 곡 상세에서 직접 올릴 대상)
 */
public record SongJacketMatchResponse(List<Match> matches, int unmatchedCount, List<MissingSong> missingSongs) {

    public record Match(String officialTitle, Long songId, String songTitle, boolean hasJacket) {
    }

    public record MissingSong(Long songId, String title) {
    }
}
