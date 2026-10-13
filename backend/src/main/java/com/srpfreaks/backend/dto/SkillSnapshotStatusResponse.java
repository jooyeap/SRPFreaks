package com.srpfreaks.backend.dto;

/**
 * 지금 `기록하기`를 누를 수 있는지. 못 누르면 reason에 이유 코드를 담는다:
 * ALREADY_TODAY(오늘 이미 기록함), NO_CHANGE(마지막 기록과 점수가 같음), NO_RECORDS(레이팅에 들어간 기록이 없음).
 * 문구는 화면이 정한다.
 */
public record SkillSnapshotStatusResponse(boolean available, String reason) {

    public static SkillSnapshotStatusResponse ok() {
        return new SkillSnapshotStatusResponse(true, null);
    }

    public static SkillSnapshotStatusResponse blocked(String reason) {
        return new SkillSnapshotStatusResponse(false, reason);
    }
}
