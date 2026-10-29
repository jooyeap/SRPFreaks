import { describe, expect, it } from "vitest";
import { fitSize, showsPhotoEntry, type RecognizeStatus } from "@/lib/recognize";

const st = (available: boolean, reason: RecognizeStatus["reason"]): RecognizeStatus => ({ available, reason, remaining: 0, weeklyLimit: 30, nextRefillAt: null });

describe("사진 입력 보조 함수", () => {
  it("긴 변을 1,568px 이하로 줄이고, 작은 사진은 그대로 둔다", () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 1568, height: 1176 });
    expect(fitSize(3024, 4032)).toEqual({ width: 1176, height: 1568 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("꺼짐·권한 없음이면 입구를 숨기고, 한도만 다 쓴 경우는 보여 준다", () => {
    expect(showsPhotoEntry(undefined)).toBe(false);
    expect(showsPhotoEntry(st(false, "DISABLED"))).toBe(false);
    expect(showsPhotoEntry(st(false, "ROLE"))).toBe(false);
    expect(showsPhotoEntry(st(false, "WEEKLY_LIMIT"))).toBe(true);
    expect(showsPhotoEntry(st(false, "DAILY_LIMIT"))).toBe(true);
    expect(showsPhotoEntry(st(true, null))).toBe(true);
  });
});
