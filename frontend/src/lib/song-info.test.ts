import { describe, expect, it } from "vitest";
import { formatBpm, isWritable } from "@/lib/song-info";

describe("곡 정보 가져오기 값 표시 (D90)", () => {
  it("BPM은 고정이면 한 값, 가변이면 범위, 없으면 줄표", () => {
    expect(formatBpm(172, 172)).toBe("172");
    expect(formatBpm(120, 180)).toBe("120–180");
    expect(formatBpm(null, null)).toBe("–");
    expect(formatBpm(150, null)).toBe("150");
  });

  it("새로 채움·덮어쓰기만 저장할 것이 있다", () => {
    expect(isWritable("FILL")).toBe(true);
    expect(isWritable("OVERWRITE")).toBe(true);
    expect(isWritable("UNCHANGED")).toBe(false);
    expect(isWritable("NONE")).toBe(false);
  });
});
