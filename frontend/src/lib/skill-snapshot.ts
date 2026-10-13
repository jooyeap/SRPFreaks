import { apiFetch } from "@/lib/api";
import type { PageResponse, SkillSnapshotResponse, SkillSnapshotStatusResponse, SnapshotBlockReason } from "@/lib/api-types";

/**
 * 레이팅 스냅샷 (D32) 쿼리 키. 앞부분을 skillKeys.me와 같은 ["skill", userId]로 시작해서,
 * 기록을 저장·수정·삭제해 레이팅이 바뀌면(records.ts가 "skill" 키를 무효화) `기록하기` 가능 여부도 다시 읽는다.
 */
export const snapshotKeys = {
  list: (userId: number, page: number) => ["skill", userId, "snapshots", page] as const,
  status: (userId: number) => ["skill", userId, "snapshots-status"] as const,
  all: (userId: number) => ["skill", userId, "snapshots"] as const,
};

export const SNAPSHOT_PAGE_SIZE = 10;

export function fetchSnapshots(page: number, signal?: AbortSignal): Promise<PageResponse<SkillSnapshotResponse>> {
  return apiFetch<PageResponse<SkillSnapshotResponse>>("/skills/me/snapshots", {
    query: { page, size: SNAPSHOT_PAGE_SIZE },
    signal,
  });
}

export function fetchSnapshotStatus(signal?: AbortSignal): Promise<SkillSnapshotStatusResponse> {
  return apiFetch<SkillSnapshotStatusResponse>("/skills/me/snapshots/status", { signal });
}

export function createSnapshot(): Promise<SkillSnapshotResponse> {
  return apiFetch<SkillSnapshotResponse>("/skills/me/snapshots", { method: "POST" });
}

/** 기록하기를 막는 이유 문구 (서버 오류 문구와 같은 뜻) */
export function blockReasonText(reason: SnapshotBlockReason): string {
  switch (reason) {
    case "ALREADY_TODAY":
      return "오늘은 이미 기록했습니다. 내일 다시 기록할 수 있습니다.";
    case "NO_CHANGE":
      return "마지막 기록과 점수가 같아 기록할 수 없습니다.";
    case "NO_RECORDS":
      return "레이팅에 들어간 기록이 없어 기록할 수 없습니다.";
  }
}

/**
 * 증감 표기. 부호를 글자로 같이 쓴다(색만으로 구분하지 않는다): `▲ +35.20` / `▼ -12.00` / `±0.00`. 첫 기록(null)은 `–`.
 * 서버가 소수 둘째 자리 점수끼리 뺀 값이라 부동소수 잡음(0.1+0.2류)은 toFixed로 정리한다.
 */
export function formatChange(change: number | null): { text: string; direction: "up" | "down" | "flat" | "none" } {
  if (change === null || !Number.isFinite(change)) {
    return { text: "–", direction: "none" };
  }
  const fixed = Math.abs(change).toFixed(2);
  if (Number(fixed) === 0) {
    return { text: "±0.00", direction: "flat" };
  }
  return change > 0 ? { text: `▲ +${fixed}`, direction: "up" } : { text: `▼ -${fixed}`, direction: "down" };
}
