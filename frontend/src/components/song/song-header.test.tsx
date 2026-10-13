import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SongHeader } from "@/components/song/SongHeader";
import type { SongDetailResponse } from "@/lib/api-types";

const song: SongDetailResponse = {
  id: 1,
  title: "テスト曲",
  artist: "A".repeat(60),
  addedVersion: "GITADORA_GALAXY_WAVE_DELTA_EXTRA_LONG_VERSION",
  titleFolder: null,
  bpmMin: null,
  bpmMax: null,
  source: null,
  titles: [],
  difficulties: [],
};

describe("SongHeader", () => {
  // jsdom은 레이아웃을 계산하지 않아서 폭을 직접 잴 수 없다. 대신 넘침을 막는 클래스가 빠지지 않는지만 지킨다
  // (2026-10-13: 띄어쓰기 없는 긴 버전 이름이 모바일에서 페이지 전체를 오른쪽으로 넓혔다).
  it("띄어쓰기 없이 긴 버전 칩은 말줄임, 아티스트는 줄바꿈으로 화면 폭을 넘지 않게 한다", () => {
    render(<SongHeader song={song} chart={null} />);
    const chip = screen.getByText(song.addedVersion ?? "");
    expect(chip).toHaveClass("max-w-full", "truncate");
    expect(chip).toHaveAttribute("title", song.addedVersion);
    expect(screen.getByText(song.artist ?? "")).toHaveClass("break-words");
  });
});
