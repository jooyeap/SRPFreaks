package com.srpfreaks.backend.dto;

/**
 * 지금 `기록하기`를 누를 수 있는지. 못 누르면 reason에 이유 코드를 담는다:
 * NO_CHANGE(마지막 기록과 점수가 같음), NO_RECORDS(레이팅에 들어간 기록이 없음).
 * replacesToday가 true면 오늘 기록이 이미 있어서 누르면 새 줄 대신 오늘 줄을 덮어쓴다(버튼 문구가 `오늘 기록 갱신`이 된다).
 * 문구는 화면이 정한다. (예전 ALREADY_TODAY는 2026-10-27 같은 날 갱신으로 바꾸면서 더 보내지 않는다)
 */
public record SkillSnapshotStatusResponse(boolean available, String reason, boolean replacesToday) {

    public static SkillSnapshotStatusResponse ok(boolean replacesToday) {
        return new SkillSnapshotStatusResponse(true, null, replacesToday);
    }

    public static SkillSnapshotStatusResponse blocked(String reason, boolean replacesToday) {
        return new SkillSnapshotStatusResponse(false, reason, replacesToday);
    }
}
