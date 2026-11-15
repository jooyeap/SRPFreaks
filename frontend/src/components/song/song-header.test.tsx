import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SongHeader } from "@/components/song/SongHeader";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";
import { resetShowJacketsForTest, setJacketData } from "@/lib/jackets";

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

const chart: SongChartResponse = { id: 10, songId: 1, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.5, noteCount: null };

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

  describe("재킷이 보일 때 (2026-11-14, 재킷 높이 안에 끝나는 정보 칸)", () => {
    beforeEach(() => {
      resetShowJacketsForTest();
      setJacketData({ enabled: true, jackets: {} });
    });
    afterEach(() => {
      setJacketData(null);
      resetShowJacketsForTest();
    });

    it("재킷은 모바일 104px 정사각이고 정보 칸은 재킷 높이 이상으로 위·아래를 벌린다(곡명+아티스트 / 태그 줄)", () => {
      render(<SongHeader song={song} chart={chart} />);
      const section = screen.getByRole("region", { name: "곡 정보" });
      expect(section.firstElementChild).toHaveClass("size-[104px]", "md:size-[140px]");
      const info = section.lastElementChild as HTMLElement;
      expect(info).toHaveClass("justify-between", "min-h-[104px]", "md:min-h-[140px]");
      // 위: 곡명과 아티스트가 한 묶음, 아래: 태그 줄(버전 칩 · 채보 알약)
      const top = info.firstElementChild as HTMLElement;
      expect(within(top).getByRole("heading", { name: "テスト曲" })).toBeInTheDocument();
      expect(within(top).getByText(song.artist ?? "")).toBeInTheDocument();
      const tags = info.lastElementChild as HTMLElement;
      expect(within(tags).getByText(song.addedVersion ?? "")).toBeInTheDocument();
      expect(tags).toHaveClass("flex-wrap");
    });

    it("곡명은 모바일에서 2줄까지만 보이고 넘치면 말줄임이다 (line-clamp-2)", () => {
      render(<SongHeader song={song} chart={chart} />);
      expect(screen.getByRole("heading", { name: "テスト曲" })).toHaveClass("line-clamp-2");
    });

    it("속성 칩은 재킷 왼쪽 위 모서리 칩이고 태그 줄에는 없다 (태그 줄이 꺾여 정보 칸이 재킷 높이를 넘지 않게)", () => {
      render(<SongHeader song={song} chart={chart} pattern="복합" />);
      const section = screen.getByRole("region", { name: "곡 정보" });
      const chip = screen.getByTestId("pattern-chip");
      expect(chip).toHaveTextContent("속성 복합");
      expect(chip).toHaveAttribute("title", "속성 복합");
      expect(section.firstElementChild).toContainElement(chip); // 재킷의 바깥 상자 안
      const info = section.lastElementChild as HTMLElement;
      expect(within(info).queryByText("속성 복합")).toBeNull();
    });

    it("속성이 없으면(서열표 밖) 속성 칩 자리를 두지 않는다", () => {
      render(<SongHeader song={song} chart={chart} />);
      expect(screen.queryByText(/^속성 /)).toBeNull();
    });
  });

  describe("재킷이 없을 때 (설정 꺼짐)", () => {
    beforeEach(() => {
      setJacketData(null);
      resetShowJacketsForTest();
    });

    it("재킷 칸이 없고, 속성 칩은 태그 줄 맨 뒤에 있다", () => {
      render(<SongHeader song={song} chart={chart} pattern="복합" />);
      const section = screen.getByRole("region", { name: "곡 정보" });
      expect(screen.queryByTestId("pattern-chip")).toBeNull();
      const info = section.lastElementChild as HTMLElement;
      expect(within(info.lastElementChild as HTMLElement).getByText("속성 복합")).toBeInTheDocument();
      // 재킷이 없으면 정보 칸에 재킷 높이 최소값을 주지 않는다
      expect(info).not.toHaveClass("min-h-[104px]");
    });
  });

  describe("버튼 줄(action)", () => {
    it("action이 있으면 재킷+정보 블록(section) 바깥, 아래 한 줄에 놓인다", () => {
      render(<SongHeader song={song} chart={chart} action={<button type="button">버튼</button>} />);
      const section = screen.getByRole("region", { name: "곡 정보" });
      const button = screen.getByRole("button", { name: "버튼" });
      expect(section.contains(button)).toBe(false);
      expect(section.nextElementSibling).toContainElement(button);
    });

    it("action이 없으면(비로그인 등) 버튼 줄을 그리지 않는다", () => {
      const { container } = render(<SongHeader song={song} chart={chart} />);
      const section = screen.getByRole("region", { name: "곡 정보" });
      expect(section.nextElementSibling).toBeNull();
      expect(container.querySelectorAll("button")).toHaveLength(0);
    });
  });
});
