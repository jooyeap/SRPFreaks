package com.srpfreaks.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 사진 한 장의 인식 결과(D55). 저장하지 않는다: 화면이 입력 칸을 채우고, 사용자가 확인한 뒤 기존 POST /records로 저장한다.
 * 읽지 못한 칸은 null이다. 플레이어 이름·ID 칸은 없다.
 *
 * @param title            사진에서 읽은 곡명(그대로)
 * @param part             GUITAR / BASS
 * @param difficulty       BASIC / ADVANCED / EXTREME / MASTER
 * @param level            사진의 레벨(예 9.75). 채보를 고를 때 확인용
 * @param achievementRate  달성률 0.00~100.00(범위 밖이면 null)
 * @param fullCombo        풀콤보(Miss 0 또는 FULL COMBO 표시). 모르면 null
 * @param superRandomPlus  SRN+ 표시가 보였는가. 다른 옵션이면 false, 모르면 null(D25: 화면이 막고 사용자가 확인해야 저장)
 * @param songDifficultyId 곡·파트·난이도로 채보 하나가 정해지면 그 id, 아니면 null
 * @param candidates       곡명으로 찾은 후보 곡(정해지지 않았을 때 고르게 한다). 최대 5개
 * @param remaining        이번 인식 뒤 남은 최근 7일 장수
 */
public record RecognizeResultResponse(String title, String part, String difficulty, BigDecimal level,
                                      BigDecimal achievementRate, Boolean fullCombo, Boolean superRandomPlus,
                                      Long songDifficultyId, List<SongCandidate> candidates, int remaining) {

    public record SongCandidate(Long songId, String title) {
    }
}
